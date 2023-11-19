package main

import (
	"encoding/json"
	"io"
	"os"
)

type TmphNode struct {
	TagName          string            `json:"tagName,omitempty"`
	StaticAttributes []StaticAttribute `json:"staticAttributes,omitempty"`
	RenderAttributes []RenderAttribute `json:"renderAttributes,omitempty"`
	Children         []*TmphNode       `json:"children,omitempty"`
	TextContent      string            `json:"textContent,omitempty"`
}

func getCurrentNode(nodeTree []*TmphNode) *TmphNode {
	nodeTreeLen := len(nodeTree)
	if nodeTreeLen == 0 {
		return nil
	}

	return nodeTree[nodeTreeLen-1]
}

type TmphAssetBucket struct {
	BucketName string   `json:"bucketName"`
	Inline     bool     `json:"inline"`
	Scripts    []string `json:"scripts"`
	Styles     []string `json:"styles"`
}

type TmphAssetBucketMap map[string]*TmphAssetBucket

type ReturnData struct {
	Nodes  []*TmphNode        `json:"nodes"`
	Assets TmphAssetBucketMap `json:"assets"`
	// TODO: SubComponents
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

	cursor := Cursor{index: 0, str: fileStr, maxIndex: len(fileStr) - 1}

	nodeTree := make([]*TmphNode, 0)

	returnData := ReturnData{Nodes: make([]*TmphNode, 0), Assets: make(TmphAssetBucketMap)}

	for cursor.index < cursor.maxIndex {
		currentNode := getCurrentNode(nodeTree)

		shouldPreserveWhitespace := false

		nodeTreeLen := len(nodeTree)
		visitNodeIndex := nodeTreeLen - 1
		for visitNodeIndex >= 0 {
			tagName := nodeTree[visitNodeIndex].TagName
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

		textContent, isClosingTag := cursor.ReadUntilTag(shouldPreserveWhitespace, childIndex)
		if textContent != "" {
			newTextNode := TmphNode{TextContent: textContent}

			if currentNode == nil {
				returnData.Nodes = append(returnData.Nodes, &newTextNode)
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
					currentNode = nodeTree[nodeTreeLen-1]
				} else if currentNode != nil {
					returnData.Nodes = append(returnData.Nodes, currentNode)
				}

				if closingNodeTagName == closedTagName {
					// If the node we just closed matches the name of the closing tag we just read, we're done.
					// Otherwise, keep going up the tree until we find a match or hit the root.
					break
				}
			}

			nodeTree = nodeTree[:nodeTreeLen]
		} else {
			openedTagName, staticAttributes, renderAttributes, isVoidElement := cursor.ReadOpeningTag()

			newNode := &TmphNode{
				TagName:          openedTagName,
				StaticAttributes: staticAttributes,
				RenderAttributes: renderAttributes,
				Children:         nil,
			}

			if isVoidElement {
				// If we're at the root node, write it out
				if currentNode == nil {
					returnData.Nodes = append(returnData.Nodes, newNode)
				} else {
					currentNode.Children = append(currentNode.Children, newNode)
				}
			} else {
				if openedTagName == "script" || openedTagName == "style" {

					elementTextContent := cursor.ReadRawTagTextContent(openedTagName, false)
					if elementTextContent != "" {
						textNode := TmphNode{TextContent: elementTextContent}
						newNode.Children = append(newNode.Children, &textNode)

						isRaw := false
						// If the script or style doesn't have a bucket attribute, we'll use the default bucket
						bucketName := DEFAULT_BUCKET_NAME

						renderAttributeLen := len(newNode.RenderAttributes)
						for i := 0; i < renderAttributeLen; i += 2 {
							attribute := newNode.RenderAttributes[i]
							attributeName := attribute.AttributeName
							if attributeName == "#raw" {
								isRaw = true
								// Raw scripts and styles should be rendered as-is
								newNode.StaticAttributes = append(newNode.StaticAttributes[:i], newNode.StaticAttributes[i+2:]...)
								break
							} else if attributeName == "#bucket" {
								// If the script or style has a #bucket attribute, use that as the bucket name
								attributeValue := attribute.AttributeValue
								if len(attributeValue) > 0 {
									bucketName = attributeValue
								}
								break
							}
						}

						if isRaw {
							if currentNode == nil {
								returnData.Nodes = append(returnData.Nodes, newNode)
							} else {
								currentNode.Children = append(currentNode.Children, newNode)
							}
						} else {
							// Create an asset bucket for the bucket name if one doesn't exist
							if _, ok := returnData.Assets[bucketName]; !ok {
								returnData.Assets[bucketName] = &TmphAssetBucket{
									BucketName: bucketName,
									Inline:     false,
									Scripts:    make([]string, 0),
									Styles:     make([]string, 0),
								}
							}

							// Add the script or style to the asset bucket
							if openedTagName == "script" {
								returnData.Assets[bucketName].Scripts = append(returnData.Assets[bucketName].Scripts, elementTextContent)
							} else {
								returnData.Assets[bucketName].Styles = append(returnData.Assets[bucketName].Styles, elementTextContent)
							}
						}
					}
				} else {
					if currentNode != nil {
						currentNode.Children = append(currentNode.Children, newNode)
					}

					newNode.Children = make([]*TmphNode, 0)
					currentNode = newNode
					nodeTree = append(nodeTree, currentNode)
					nodeTreeLen++
				}
			}
		}
	}

	returnJSON, err := json.Marshal(returnData)
	if err != nil {
		panic(err)
	}
	os.Stdout.Write(returnJSON)
}
