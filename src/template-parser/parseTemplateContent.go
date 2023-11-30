package main

const DEFAULT_BUCKET_NAME = "default"

func isRelativePath(path string) bool {
	return path[0] == '.' || path[0] == '/'
}

func parseElementChildren(parentNode *TmphNode, elementContent string, shouldPreserveWhiteSpace bool, line int, column int, component *Component, templateData *TemplateData) {
	if elementContent == "" {
		return
	}

	cursor := NewCursor(elementContent, line, column)

	for !cursor.IsAtEnd() {
		textContentStartPosition := cursor.GetPosition()

		textContent := cursor.ReadUntilTag()

		isAtEndOfElementContent := cursor.IsAtEnd()

		if !shouldPreserveWhiteSpace {
			// Flatten whitespace if we don't need to preserve it
			textContent = flattenWhiteSpace(
				textContent,
				true,
				// If this is the first child of an element, strip leading whitespace
				len(parentNode.Children) == 0,
				// If we just encountered a closing tag or hit the end of the parent element's content,
				// strip trailing whitespace
				isAtEndOfElementContent,
			)
		}

		if textContent != "" {
			parentNode.AppendChild(
				&TmphNode{
					TextContent: textContent,
					Position:    textContentStartPosition,
				},
			)
		}

		if isAtEndOfElementContent {
			break
		}

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
		// Get the start position as a position string as well
		childrenStartPosition := cursor.GetPosition()

		elementChildContent := cursor.ReadRawTagTextContent(
			openedTagName,
			// Script and style tags don't have nested tags
			openedTagName != "script" && openedTagName != "style",
		)

		switch newChildNode.TagName {
		case "template":
			if isComponentAttrSet, componentName, _ := newChildNode.GetRenderAttribute("component"); isComponentAttrSet && componentName != "" {
				if templateData.InlineComponents == nil {
					templateData.InlineComponents = make(map[string]*Component)
				} else if _, ok := templateData.InlineComponents[componentName]; ok {
					panic("Duplicate inline component name: " + componentName + " at " + newChildNode.Position)
				}

				// Make a new component which we will use for the next parseElementChildren pass
				newComponent := &Component{
					RootNode:       newChildNode,
					HasDefaultSlot: false,
					NamedSlots:     make(map[string]bool),
					PropTypesJSDoc: "",
				}
				templateData.InlineComponents[componentName] = newComponent
				parseElementChildren(newChildNode, elementChildContent, false, childrenStartLine, childrenStartColumn, newComponent, templateData)
			}
		case "slot":
			if _, slotName := newChildNode.GetStaticAttribute("name"); slotName != "" {
				component.NamedSlots[slotName] = true
			} else {
				component.HasDefaultSlot = true
			}
			parentNode.AppendChild(newChildNode)
			if elementChildContent != "" {
				parseElementChildren(newChildNode, elementChildContent, shouldPreserveWhiteSpace, childrenStartLine, childrenStartColumn, component, templateData)
			}
		case "link":
			isRelSet, rel := newChildNode.GetStaticAttribute("rel")
			isHrefSet, href := newChildNode.GetStaticAttribute("href")

			if isRelSet && isHrefSet && rel != "" && href != "" {
				if rel == "import" {
					_, importName := newChildNode.GetStaticAttribute("as")

					templateData.ComponentImports = append(
						templateData.ComponentImports,
						ComponentImport{
							ImportName: importName,
							Path:       href,
							Position:   newChildNode.Position,
						},
					)
					break
				} else if rel == "stylesheet" {
					// If this is a relative import of a stylesheet file, add it to the asset bucket
					if isRelativePath(href) {
						_, bucketName, _ := newChildNode.GetRenderAttribute("bucket")
						if bucketName == "" {
							bucketName = DEFAULT_BUCKET_NAME
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
						break
					}
				}
			}

			parentNode.AppendChild(newChildNode)
		case "style":
			flattenedStyleContent := flattenWhiteSpace(
				elementChildContent,
				false, true, true,
			)

			if isRawAttrSet, _, _ := newChildNode.GetRenderAttribute("raw"); isRawAttrSet {
				// If the style has a #raw attribute, just add it to the node tree without processing it
				if flattenedStyleContent != "" {
					newChildNode.AppendChild(&TmphNode{
						TextContent: flattenedStyleContent,
						Position:    childrenStartPosition,
					})
				}
				parentNode.AppendChild(newChildNode)
			} else {
				_, bucketName, _ := newChildNode.GetRenderAttribute("bucket")
				if bucketName == "" {
					// If the style doesn't have a bucket attribute, we'll use the default bucket
					bucketName = DEFAULT_BUCKET_NAME
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
					Content:  flattenedStyleContent,
					Position: childrenStartPosition,
				})
			}
		case "script":
			// Whether the script should be appended to the node tree instead of being added to an asset bucket for processing
			shouldAppendToNodeTree := false

			if isRawAttrSet, _, _ := newChildNode.GetRenderAttribute("raw"); isRawAttrSet {
				// If the style has a #raw attribute, keep it in the node tree as-is without processing
				shouldAppendToNodeTree = true
			} else if isRenderAttrSet, _, _ := newChildNode.GetRenderAttribute("render"); isRenderAttrSet {
				// If the script has a #render attribute, we'll want to add it to the node tree;
				// the tag will not be included in the rendered output, but its position in the tree matters because its contents
				// will be placed in the compiled component's render function logic
				shouldAppendToNodeTree = true
			}

			flattenedScriptContent := flattenWhiteSpace(
				elementChildContent,
				false, true, true,
			)

			if shouldAppendToNodeTree {
				if flattenedScriptContent != "" {
					newChildNode.AppendChild(&TmphNode{
						TextContent: flattenedScriptContent,
						Position:    childrenStartPosition,
					})
				}
				parentNode.AppendChild(newChildNode)
			} else {
				// We're going to add the script to an asset bucket for processing
				isSrcAttrSet, src := newChildNode.GetStaticAttribute("src")

				if isSrcAttrSet && src != "" {
					if !isRelativePath(src) {
						// External scripts will be left alone, just append them to the node tree
						parentNode.AppendChild(newChildNode)
						break
					}
				}

				if src != "" || flattenedScriptContent != "" {
					_, bucketName, _ := newChildNode.GetRenderAttribute("bucket")
					if bucketName == "" {
						// If the script doesn't have a bucket attribute, we'll use the default bucket
						bucketName = DEFAULT_BUCKET_NAME
					}

					_, _, scope := newChildNode.GetRenderAttribute("scope")
					if scope == "" {
						// Default to global scope
						scope = "global"
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
							Position: childrenStartPosition,
						})
					}
				}
			}
		default:
			parentNode.AppendChild(newChildNode)

			if !isVoid && elementChildContent != "" {
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
