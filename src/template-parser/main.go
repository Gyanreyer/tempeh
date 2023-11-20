package main

import (
	"encoding/json"
	"io"
	"os"
)

func getLast[V interface{}](arr []*V) *V {
	arrLen := len(arr)
	if arrLen == 0 {
		return nil
	}

	return arr[arrLen-1]
}

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

type TmphNode struct {
	TagName          string            `json:"tagName,omitempty"`
	StaticAttributes []StaticAttribute `json:"staticAttributes,omitempty"`
	RenderAttributes []RenderAttribute `json:"renderAttributes,omitempty"`
	Children         []*TmphNode       `json:"children,omitempty"`
	TextContent      string            `json:"textContent,omitempty"`
	Position         string            `json:"position,omitempty"`
}

type TmphAssetBucket struct {
	Scripts []string `json:"scripts,omitempty"`
	Styles  []string `json:"styles,omitempty"`
}

type TmphAssetBucketMap map[string]*TmphAssetBucket

type ComponentImport struct {
	ImportName string `json:"importName,omitempty"`
	Path       string `json:"path"`
	Position   string `json:"position,omitempty"`
}

type ParsedTemplateData struct {
	Nodes            []*TmphNode                    `json:"nodes"`
	Assets           TmphAssetBucketMap             `json:"assets,omitempty"`
	HasDefaultSlot   bool                           `json:"hasDefaultSlot"`
	NamedSlots       []string                       `json:"namedSlots,omitempty"`
	ComponentImports []ComponentImport              `json:"componentImports,omitempty"`
	PropTypesJSDoc   string                         `json:"propTypesJSDoc,omitempty"`
	InlineComponents map[string]*ParsedTemplateData `json:"inlineComponents,omitempty"`
	NodeTree         []*TmphNode                    `json:"-"`
	Position         string                         `json:"position,omitempty"`
}

const DEFAULT_BUCKET_NAME = "default"

func main() {
	var fileBytes []byte
	var err error

	if len(os.Args) > 1 {
		// If a file path arg was provided, read in the file to parse
		filePath := os.Args[1]
		fileBytes, err = os.ReadFile(filePath)
	} else {
		// If no file path Read in the buffer of the file we want to parse from stdin
		fileBytes, err = io.ReadAll(os.Stdin)
	}

	if err != nil {
		panic(err)
	}

	fileStr := string(fileBytes)

	cursor := Cursor{index: 0, str: fileStr, maxIndex: len(fileStr) - 1, line: 1, column: 1}

	rootTemplateData := ParsedTemplateData{
		Nodes:            make([]*TmphNode, 0),
		Assets:           make(TmphAssetBucketMap),
		HasDefaultSlot:   false,
		NamedSlots:       make([]string, 0),
		ComponentImports: make([]ComponentImport, 0),
		PropTypesJSDoc:   "",
		InlineComponents: make(map[string]*ParsedTemplateData, 0),
		NodeTree:         make([]*TmphNode, 0),
		Position:         cursor.GetPosition(),
	}

	templateDataTree := []*ParsedTemplateData{&rootTemplateData}

	for cursor.index < cursor.maxIndex {
		currentTemplateData := getLast(templateDataTree)
		currentNode := getLast(currentTemplateData.NodeTree)

		shouldPreserveWhitespace := false

		nodeTreeLen := len(currentTemplateData.NodeTree)
		visitNodeIndex := nodeTreeLen - 1
		for visitNodeIndex >= 0 {
			tagName := currentTemplateData.NodeTree[visitNodeIndex].TagName
			if tagName == "pre" || tagName == "textarea" {
				shouldPreserveWhitespace = true
				break
			}
			visitNodeIndex--
		}

		childIndex := 0
		if currentNode != nil && currentNode.Children != nil {
			childIndex = len(currentNode.Children)
		}

		startPosition := cursor.GetPosition()
		textContent, isClosingTag := cursor.ReadUntilTag(shouldPreserveWhitespace, childIndex)

		if textContent != "" {
			newTextNode := TmphNode{
				TextContent: textContent,
				Position:    startPosition,
			}

			if currentNode == nil {
				currentTemplateData.Nodes = append(currentTemplateData.Nodes, &newTextNode)
			} else {
				currentNode.Children = append(currentNode.Children, &newTextNode)
			}
		}

		if cursor.index >= cursor.maxIndex {
			// Break if we've reached the end of the file
			break
		}

		if isClosingTag {
			closedTagName := cursor.ReadClosingTag()

			for nodeTreeLen >= 1 {
				closingNodeTagName := currentNode.TagName

				nodeTreeLen -= 1
				if nodeTreeLen >= 1 {
					currentNode = currentTemplateData.NodeTree[nodeTreeLen-1]
				} else if currentNode != nil {
					currentTemplateData.Nodes = append(currentTemplateData.Nodes, currentNode)
				}

				if closingNodeTagName == closedTagName {
					// If the node we just closed matches the name of the closing tag we just read, we're done.
					// Otherwise, keep going up the tree until we find a match or hit the root.
					break
				}
			}

			if nodeTreeLen == 0 && closedTagName == "template" {
				templateDataTreeLen := len(templateDataTree)
				if templateDataTreeLen <= 1 {
					panic("Encountered unexpected closing template tag")
				}
				// Drop off the template data for the template we just closed
				templateDataTree = templateDataTree[:templateDataTreeLen-1]
			}

			currentTemplateData.NodeTree = currentTemplateData.NodeTree[:nodeTreeLen]
		} else {
			tagStartPosition := cursor.GetPosition()
			openedTagName, staticAttributes, renderAttributes, isVoidElement := cursor.ReadOpeningTag()

			newNode := &TmphNode{
				TagName:          openedTagName,
				StaticAttributes: staticAttributes,
				RenderAttributes: renderAttributes,
				Children:         nil,
				Position:         tagStartPosition,
			}

			if isVoidElement {
				// If we're at the root node, write it out
				if currentNode == nil {
					currentTemplateData.Nodes = append(currentTemplateData.Nodes, newNode)
				} else {
					currentNode.Children = append(currentNode.Children, newNode)
				}
			} else {
				shouldSkipNode := false

				switch openedTagName {
				case "template":
					{
						componentAttribute := getRenderAttribute(renderAttributes, "component")
						if componentAttribute != nil && componentAttribute.AttributeValue != "" {
							shouldSkipNode = true
							componentName := componentAttribute.AttributeValue

							// Create a new template data object for the component
							componentTemplateData := ParsedTemplateData{
								Nodes:            make([]*TmphNode, 0),
								Assets:           make(TmphAssetBucketMap),
								HasDefaultSlot:   false,
								NamedSlots:       make([]string, 0),
								ComponentImports: make([]ComponentImport, 0),
								PropTypesJSDoc:   "",
								Position:         tagStartPosition,
							}

							if _, ok := currentTemplateData.InlineComponents[componentName]; ok {
								panic("Duplicate inline component name: " + componentName)
							}

							// Add the component template data to the root template data's inline components
							// We can go straight to the root because nested inline components are all hoisted to the top
							rootTemplateData.InlineComponents[componentName] = &componentTemplateData
							templateDataTree = append(templateDataTree, &componentTemplateData)
						}
					}
				case "script":
				case "style":
					{
						elementTextContent := cursor.ReadRawTagTextContent(openedTagName, false)
						if elementTextContent != "" {
							rawAttribute := getRenderAttribute(renderAttributes, "raw")

							if rawAttribute == nil {
								shouldSkipNode = true

								if openedTagName == "script" {
									propTypesAttribute := getRenderAttribute(renderAttributes, "types")
									if propTypesAttribute != nil {
										// If a #types attribute is present, we'll use the script contents
										// as the prop types JSDoc for the component
										currentTemplateData.PropTypesJSDoc = elementTextContent
										break
									}
								}

								// If the script or style doesn't have a bucket attribute, we'll use the default bucket
								bucketName := DEFAULT_BUCKET_NAME

								bucketNameAttribute := getRenderAttribute(renderAttributes, "bucket")
								if bucketNameAttribute != nil && bucketNameAttribute.AttributeValue != "" {
									bucketName = bucketNameAttribute.AttributeValue
								}

								// Create an asset bucket for the bucket name if one doesn't exist
								if _, ok := currentTemplateData.Assets[bucketName]; !ok {
									currentTemplateData.Assets[bucketName] = &TmphAssetBucket{
										Scripts: make([]string, 0),
										Styles:  make([]string, 0),
									}
								}

								// Add the script or style to the asset bucket
								if openedTagName == "script" {
									currentTemplateData.Assets[bucketName].Scripts = append(currentTemplateData.Assets[bucketName].Scripts, elementTextContent)
								} else {
									currentTemplateData.Assets[bucketName].Styles = append(currentTemplateData.Assets[bucketName].Styles, elementTextContent)
								}
							} else {
								// If the script or style has a raw attribute, we'll just add it to the node tree
								textNode := TmphNode{
									TextContent: elementTextContent,
									Position:    tagStartPosition,
								}
								newNode.Children = append(newNode.Children, &textNode)
							}
						}
					}
				case "link":
					{
						relAttribute := getStaticAttribute(staticAttributes, "rel")
						if relAttribute != nil && relAttribute.AttributeValue == "import" {
							shouldSkipNode = true
							hrefAttribute := getStaticAttribute(staticAttributes, "href")
							if hrefAttribute != nil && hrefAttribute.AttributeValue != "" {
								importName := ""
								importAsNameAttribute := getStaticAttribute(staticAttributes, "as")
								if importAsNameAttribute != nil {
									importName = importAsNameAttribute.AttributeValue
								}

								currentTemplateData.ComponentImports = append(
									currentTemplateData.ComponentImports,
									ComponentImport{
										ImportName: importName,
										Path:       hrefAttribute.AttributeValue,
										Position:   tagStartPosition,
									},
								)
							}
						}
					}
				case "slot":
					{
						slotNameAttribute := getStaticAttribute(staticAttributes, "name")

						if slotNameAttribute != nil && slotNameAttribute.AttributeValue != "" {
							currentTemplateData.NamedSlots = append(currentTemplateData.NamedSlots, slotNameAttribute.AttributeValue)
						} else {
							currentTemplateData.HasDefaultSlot = true
						}
					}
				}

				if !shouldSkipNode {
					if currentNode != nil {
						currentNode.Children = append(currentNode.Children, newNode)
					}

					newNode.Children = make([]*TmphNode, 0)
					currentNode = newNode
					currentTemplateData.NodeTree = append(currentTemplateData.NodeTree, currentNode)
					nodeTreeLen++
				}
			}
		}
	}

	returnJSON, err := json.Marshal(rootTemplateData)
	if err != nil {
		panic(err)
	}
	os.Stdout.Write(returnJSON)
}
