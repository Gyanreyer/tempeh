package main

func parseElementChildren(parentNode *TmphNode, elementContent string, shouldPreserveWhiteSpace bool, line int, column int, component *Component, templateData *TemplateData) {
	if elementContent == "" {
		return
	}

	cursor := NewCursor(elementContent, line, column)

loop:
	for !cursor.IsAtEnd() {
		textContentStartPosition := cursor.GetPosition()

		textContent, isClosingTag := cursor.ReadUntilTag()

		if !shouldPreserveWhiteSpace {
			// Flatten whitespace if we don't need to preserve it
			textContent = flattenWhiteSpace(
				textContent,
				true,
				// If this is the first child of an element, strip leading whitespace
				len(parentNode.Children) == 0,
				// If we just encountered a closing tag, meaning this is the last child of an element, strip trailing whitespace
				isClosingTag,
			)
		}

		if textContent != "" {
			parentNode.Children = append(parentNode.Children, &TmphNode{
				TextContent: textContent,
				Position:    textContentStartPosition,
			})
		}

		if cursor.IsAtEnd() {
			break
		}

		if isClosingTag {
			cursor.ReadClosingTag()
		} else {
			tagStartPosition := cursor.GetPosition()
			openedTagName, staticAttributes, renderAttributes, isVoid := cursor.ReadOpeningTag()

			newChildNode := &TmphNode{
				TagName:          openedTagName,
				StaticAttributes: staticAttributes,
				RenderAttributes: renderAttributes,
				Position:         tagStartPosition,
				Children:         make([]*TmphNode, 0),
			}

			// Grab the line and column that the cursor is at for the start position of the tag's child contents
			childrenStartLine := cursor.line
			childrenStartColumn := cursor.column

			elementChildContent := cursor.ReadRawTagTextContent(
				openedTagName,
				// Script and style tags don't have nested tags
				openedTagName != "script" && openedTagName != "style",
			)

			switch newChildNode.TagName {
			case "template":
				componentNameAttribute := getRenderAttribute(renderAttributes, "component")
				if componentNameAttribute != nil {
					componentName := componentNameAttribute.AttributeValue
					if componentName != "" {
						if templateData.InlineComponents == nil {
							templateData.InlineComponents = make(map[string]*Component)
						} else if _, ok := templateData.InlineComponents[componentName]; ok {
							panic("Duplicate inline component name: " + componentName + " at " + newChildNode.Position)
						}

						// Make a new component which we will use for the next parseElementChildren pass
						component = &Component{
							RootNode:       newChildNode,
							HasDefaultSlot: false,
							NamedSlots:     make(map[string]bool),
							PropTypesJSDoc: "",
						}
						templateData.InlineComponents[componentName] = component
					}
				}
			case "slot":
				if slotNameAttribute := getStaticAttribute(staticAttributes, "name"); slotNameAttribute != nil && slotNameAttribute.AttributeValue != "" {
					component.NamedSlots[slotNameAttribute.AttributeValue] = true
				} else {
					component.HasDefaultSlot = true
				}
			case "link":
				relAttribute := getStaticAttribute(staticAttributes, "rel")
				hrefAttribute := getStaticAttribute(staticAttributes, "href")

				href := ""
				if hrefAttribute != nil {
					href = hrefAttribute.AttributeValue
				}

				if relAttribute != nil && href != "" {
					switch relAttribute.AttributeValue {
					case "import":
						importName := ""
						if importAsNameAttribute := getStaticAttribute(staticAttributes, "as"); importAsNameAttribute != nil {
							importName = importAsNameAttribute.AttributeValue
						}

						templateData.ComponentImports = append(
							templateData.ComponentImports,
							ComponentImport{
								ImportName: importName,
								Path:       href,
								Position:   newChildNode.Position,
							},
						)
						// Return early because we don't want to add this link to the node tree
						continue loop
					case "stylesheet":
						// If this is a relative import of a stylesheet file, add it to the asset bucket
						if href[0] == '.' || href[0] == '/' {
							bucketName := DEFAULT_BUCKET_NAME
							if bucketNameAttribute := getRenderAttribute(renderAttributes, "bucket"); bucketNameAttribute != nil && bucketNameAttribute.AttributeValue != "" {
								bucketName = bucketNameAttribute.AttributeValue
							}

							if _, ok := templateData.Assets[bucketName]; !ok {
								templateData.Assets[bucketName] = &TmphAssetBucket{
									Scripts: make([]AssetBucketScript, 0),
									Styles:  make([]AssetBucketStyle, 0),
								}
							}

							bucket := templateData.Assets[bucketName]

							bucket.Styles = append(bucket.Styles, AssetBucketStyle{
								Path:     href,
								Position: newChildNode.Position,
							})
							continue loop
						}
					}
				}
			case "style":
				if rawAttribute := getRenderAttribute(renderAttributes, "raw"); rawAttribute != nil {
					// If the style has a #raw attribute, just add it to the node tree without processing it
					newChildNode.Children = append(newChildNode.Children, &TmphNode{
						TextContent: elementChildContent,
						Position:    newChildNode.Position,
					})
					parentNode.Children = append(parentNode.Children, newChildNode)
				} else {
					// If the style doesn't have a bucket attribute, we'll use the default bucket
					bucketName := DEFAULT_BUCKET_NAME

					if bucketNameAttribute := getRenderAttribute(renderAttributes, "bucket"); bucketNameAttribute != nil && bucketNameAttribute.AttributeValue != "" {
						bucketName = bucketNameAttribute.AttributeValue
					}

					// Create an asset bucket for the bucket name if one doesn't exist
					if _, ok := templateData.Assets[bucketName]; !ok {
						templateData.Assets[bucketName] = &TmphAssetBucket{
							Scripts: make([]AssetBucketScript, 0),
							Styles:  make([]AssetBucketStyle, 0),
						}
					}

					bucket := templateData.Assets[bucketName]

					bucket.Styles = append(bucket.Styles, AssetBucketStyle{
						Content:  elementChildContent,
						Position: newChildNode.Position,
					})
				}

				continue loop
			case "script":
				// Whether the script should be appended to the node tree instead of being added to an asset bucket for processing
				shouldAppendToNodeTree := false

				if rawAttribute := getRenderAttribute(renderAttributes, "raw"); rawAttribute != nil {
					// If the style has a #raw attribute, keep it in the node tree as-is without processing
					shouldAppendToNodeTree = true
				} else if renderScriptAttribute := getRenderAttribute(renderAttributes, "render"); renderScriptAttribute != nil {
					// If the script has a #render attribute, we'll want to add it to the node tree;
					// the tag will not be included in the rendered output, but its position in the tree matters because its contents
					// will be placed in the compiled component's render function logic
					shouldAppendToNodeTree = true
				}

				if shouldAppendToNodeTree {
					newChildNode.Children = append(newChildNode.Children, &TmphNode{
						TextContent: elementChildContent,
						Position:    newChildNode.Position,
					})
					parentNode.Children = append(parentNode.Children, newChildNode)
				} else {
					// We're going to add the script to an asset bucket for processing
					src := ""
					if srcAttribute := getStaticAttribute(staticAttributes, "src"); srcAttribute != nil && srcAttribute.AttributeValue != "" {
						// Only add the script to the asset bucket if it's a relative path
						if srcAttribute.AttributeValue[0] == '.' || srcAttribute.AttributeValue[0] == '/' {
							src = srcAttribute.AttributeValue
						} else {
							// External scripts will be left alone
							break
						}
					}

					flattenedScriptContent := flattenWhiteSpace(
						elementChildContent,
						false, true, true,
					)

					if src != "" || flattenedScriptContent != "" {
						// If the script doesn't have a bucket attribute, we'll use the default bucket
						bucketName := DEFAULT_BUCKET_NAME

						if bucketNameAttribute := getRenderAttribute(renderAttributes, "bucket"); bucketNameAttribute != nil && bucketNameAttribute.AttributeValue != "" {
							bucketName = bucketNameAttribute.AttributeValue
						}

						// Default to global scope
						scope := "global"
						if scopeAttribute := getRenderAttribute(renderAttributes, "scope"); scopeAttribute != nil && scopeAttribute.AttributeModifier != "" {
							scope = scopeAttribute.AttributeModifier
						}

						// Create an asset bucket for the bucket name if one doesn't exist
						if _, ok := templateData.Assets[bucketName]; !ok {
							templateData.Assets[bucketName] = &TmphAssetBucket{
								Scripts: make([]AssetBucketScript, 0),
								Styles:  make([]AssetBucketStyle, 0),
							}
						}

						bucket := templateData.Assets[bucketName]

						if src != "" {
							bucket.Scripts = append(bucket.Scripts, AssetBucketScript{
								Path:     src,
								Scope:    scope,
								Position: newChildNode.Position,
							})
						} else {
							bucket.Scripts = append(bucket.Scripts, AssetBucketScript{
								Content:  flattenedScriptContent,
								Scope:    scope,
								Position: newChildNode.Position,
							})
						}
					}
				}
				continue loop
			}

			parentNode.Children = append(parentNode.Children, newChildNode)

			if !isVoid {
				parseElementChildren(
					newChildNode,
					elementChildContent,
					// Preserve whitespace for pre and textarea tags
					shouldPreserveWhiteSpace || openedTagName == "pre" || openedTagName == "textarea",
					childrenStartLine,
					childrenStartColumn,
					component,
					templateData,
				)
			}
		}
	}
}
