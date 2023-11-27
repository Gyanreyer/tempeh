package main

func getStaticAttribute(staticAttributes []StaticAttribute, attributeName string) *StaticAttribute {
	for _, attribute := range staticAttributes {
		if attribute.AttributeName == attributeName {
			return &attribute
		}
	}

	return nil
}

func getRenderAttribute(renderAttributes []RenderAttribute, attributeName string) *RenderAttribute {
	for _, attribute := range renderAttributes {
		if attribute.AttributeName == attributeName {
			return &attribute
		}
	}

	return nil
}

func parseTemplateContent(cursor *Cursor, shouldPreserveWhiteSpace bool, templateData *ParsedTemplateData, rootTemplateData *ParsedTemplateData) {
	parentNode := templateData.CurrentLeaf

	isFirstChild := len(parentNode.Children) == 0

	textStartPosition := cursor.GetPosition()
	textContent, isClosingTag := cursor.ReadUntilTag()

	if !shouldPreserveWhiteSpace {
		// Flatten whitespace if we don't need to preserve it
		textContent = flattenWhiteSpace(
			textContent,
			true,
			// If this is the first child of an element, strip leading whitespace
			isFirstChild,
			// If we just encountered a closing tag, meaning this is the last child of an element, strip trailing whitespace
			isClosingTag,
		)
	}

	if textContent != "" {
		newTextNode := &TmphNode{
			TextContent: textContent,
			Position:    textStartPosition,
			Parent:      parentNode,
		}

		parentNode.Children = append(parentNode.Children, newTextNode)
	}

	if cursor.IsAtEnd() {
		return
	}

	if isClosingTag {
		closedTagName := cursor.ReadClosingTag()

		// Keep walking up the tree closing leaves
		// until we find the node that matches the closing tag
		for templateData.CurrentLeaf.Parent != nil {
			leafTagName := templateData.CurrentLeaf.TagName
			templateData.CurrentLeaf = templateData.CurrentLeaf.Parent
			if leafTagName == closedTagName {
				break
			}
		}
		return
	}

	// We have an opening tag!
	tagStartPosition := cursor.GetPosition()
	openedTagName, staticAttributes, renderAttributes, isVoidElement := cursor.ReadOpeningTag()

	newNode := &TmphNode{
		TagName:          openedTagName,
		StaticAttributes: staticAttributes,
		RenderAttributes: renderAttributes,
		Children:         nil,
		Position:         tagStartPosition,
		Parent:           parentNode,
	}

	if isVoidElement {
		parentNode.Children = append(parentNode.Children, newNode)
		return
	}

	switch openedTagName {
	case "template":
		componentAttribute := getRenderAttribute(renderAttributes, "component")
		if componentAttribute != nil && componentAttribute.AttributeValue != "" {
			componentName := componentAttribute.AttributeValue

			// Create a new template data object for the component
			newComponentData := &ParsedTemplateData{
				Nodes:            newNode,
				HasDefaultSlot:   false,
				NamedSlots:       make([]string, 0),
				ComponentImports: make([]ComponentImport, 0),
				PropTypesJSDoc:   "",
				CurrentLeaf:      newNode,
			}

			if _, ok := rootTemplateData.InlineComponents[componentName]; ok {
				panic("Duplicate inline component name: " + componentName)
			}

			// Add the component template data to the root template data's inline components
			// We can go straight to the root because nested inline components are all hoisted to the top
			rootTemplateData.InlineComponents[componentName] = newComponentData
			parseTemplateContent(cursor, shouldPreserveWhiteSpace, newComponentData, rootTemplateData)
			// Don't include inline components in node tree
			return
		}
	case "slot":
		slotNameAttribute := getStaticAttribute(staticAttributes, "name")

		if slotNameAttribute != nil && slotNameAttribute.AttributeValue != "" {
			templateData.NamedSlots = append(templateData.NamedSlots, slotNameAttribute.AttributeValue)
		} else {
			templateData.HasDefaultSlot = true
		}
	case "link":
		relAttribute := getStaticAttribute(staticAttributes, "rel")
		if relAttribute != nil && relAttribute.AttributeValue == "import" {
			hrefAttribute := getStaticAttribute(staticAttributes, "href")
			if hrefAttribute != nil && hrefAttribute.AttributeValue != "" {
				importName := ""
				importAsNameAttribute := getStaticAttribute(staticAttributes, "as")
				if importAsNameAttribute != nil {
					importName = importAsNameAttribute.AttributeValue
				}

				rootTemplateData.ComponentImports = append(
					rootTemplateData.ComponentImports,
					ComponentImport{
						ImportName: importName,
						Path:       hrefAttribute.AttributeValue,
						Position:   tagStartPosition,
					},
				)
			}
			// Don't include import links in node tree
			return
		}
	case "style":
		elementTextContent, tagContentsStartPosition := cursor.ReadRawTagTextContent(openedTagName, false)

		if rawAttribute := getRenderAttribute(renderAttributes, "raw"); rawAttribute != nil {
			textNode := TmphNode{
				TextContent: elementTextContent,
				Position:    tagContentsStartPosition,
			}
			newNode.Children = append(make([]*TmphNode, 0), &textNode)
			parentNode.Children = append(parentNode.Children, newNode)
		} else if len(elementTextContent) > 0 {

			// If the style doesn't have a bucket attribute, we'll use the default bucket
			bucketName := DEFAULT_BUCKET_NAME

			if bucketNameAttribute := getRenderAttribute(renderAttributes, "bucket"); bucketNameAttribute != nil && bucketNameAttribute.AttributeValue != "" {
				bucketName = bucketNameAttribute.AttributeValue
			}

			// Create an asset bucket for the bucket name if one doesn't exist
			if _, ok := rootTemplateData.Assets[bucketName]; !ok {
				rootTemplateData.Assets[bucketName] = &TmphAssetBucket{
					Scripts: make([]AssetBucketScript, 0),
					Styles:  make([]AssetBucketStyle, 0),
				}
			}

			bucketEntry := AssetBucketStyle{
				Content:  elementTextContent,
				Position: tagStartPosition,
			}
			rootTemplateData.Assets[bucketName].Styles = append(rootTemplateData.Assets[bucketName].Styles, bucketEntry)
		}
		return
	case "script":
		elementTextContent, tagContentsStartPosition := cursor.ReadRawTagTextContent(openedTagName, false)

		if rawAttribute := getRenderAttribute(renderAttributes, "raw"); rawAttribute != nil {
			textNode := TmphNode{
				TextContent: elementTextContent,
				Position:    tagContentsStartPosition,
			}
			newNode.Children = append(make([]*TmphNode, 0), &textNode)
			parentNode.Children = append(parentNode.Children, newNode)
		} else if len(elementTextContent) > 0 {
			if isRenderScriptAttribute := getRenderAttribute(renderAttributes, "render"); isRenderScriptAttribute != nil {
				// If the script has a render attribute, we'll want to add it to the node tree
				// as a child of the current node since its position in the tree is important
				textNode := TmphNode{
					TextContent: elementTextContent,
					Position:    tagContentsStartPosition,
				}
				newNode.Children = append(make([]*TmphNode, 0), &textNode)
				parentNode.Children = append(parentNode.Children, newNode)
			} else if propTypesAttribute := getRenderAttribute(renderAttributes, "types"); propTypesAttribute != nil {
				// If a #types attribute is present, we'll use the script contents
				// as the prop types JSDoc for the component
				templateData.PropTypesJSDoc = elementTextContent
			} else {

				// If the script doesn't have a bucket attribute, we'll use the default bucket
				bucketName := DEFAULT_BUCKET_NAME

				bucketNameAttribute := getRenderAttribute(renderAttributes, "bucket")
				if bucketNameAttribute != nil && bucketNameAttribute.AttributeValue != "" {
					bucketName = bucketNameAttribute.AttributeValue
				}

				// Create an asset bucket for the bucket name if one doesn't exist
				if _, ok := rootTemplateData.Assets[bucketName]; !ok {
					rootTemplateData.Assets[bucketName] = &TmphAssetBucket{
						Scripts: make([]AssetBucketScript, 0),
						Styles:  make([]AssetBucketStyle, 0),
					}
				}

				scope := "global"
				scopeAttribute := getRenderAttribute(renderAttributes, "scope")
				if scopeAttribute != nil {
					scope = scopeAttribute.AttributeModifier
				}

				bucketEntry := AssetBucketScript{
					Content:  elementTextContent,
					Position: tagStartPosition,
					Scope:    scope,
				}
				rootTemplateData.Assets[bucketName].Scripts = append(rootTemplateData.Assets[bucketName].Scripts, bucketEntry)
			}
		}
		return
	}

	parentNode.Children = append(parentNode.Children, newNode)
	templateData.CurrentLeaf = newNode

	shouldPreserveWhiteSpace = shouldPreserveWhiteSpace || openedTagName == "pre" || openedTagName == "textarea"

	parseTemplateContent(cursor, shouldPreserveWhiteSpace, templateData, rootTemplateData)
}
