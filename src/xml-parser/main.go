package main

import (
	"encoding/json"
	"io"
	"os"
)

type TmphNode struct {
	TagName    string        `json:"tagName"`
	Attributes []interface{} `json:"attributes"`
	Children   []interface{} `json:"children"`
}

func getCurrentNode(nodeTree []*TmphNode) *TmphNode {
	nodeTreeLen := len(nodeTree)
	if nodeTreeLen == 0 {
		return nil
	}

	return nodeTree[nodeTreeLen-1]
}

func main() {
	// Read in the file to parse from stdin
	fileBytes, err := io.ReadAll(os.Stdin)
	if err != nil {
		panic(err)
	}

	fileStr := string(fileBytes)

	cursor := Cursor{index: 0, str: fileStr, maxIndex: len(fileStr) - 1}

	nodeTree := make([]*TmphNode, 0)
	isFirstNode := true

	os.Stdout.Write([]byte{'['})

	for cursor.index < cursor.maxIndex {
		currentNode := getCurrentNode(nodeTree)

		shouldPreserveWhitespace := false

		nodeTreeLen := len(nodeTree)
		visitNodeIndex := nodeTreeLen - 1
		for visitNodeIndex >= 0 {
			if nodeTree[visitNodeIndex].TagName == "pre" || nodeTree[visitNodeIndex].TagName == "textarea" {
				shouldPreserveWhitespace = true
				break
			}
			visitNodeIndex--
		}

		textContent, isClosingTag := cursor.ReadUntilTag(shouldPreserveWhitespace)
		if textContent != "" {
			if currentNode == nil {
				stringifiedNode, err := json.Marshal(textContent)

				if err != nil {
					panic(err)
				}

				if !isFirstNode {
					// If this isn't the first node, add a comma separating it from the previous node
					os.Stdout.Write([]byte{','})
				} else {
					isFirstNode = false
				}
				os.Stdout.Write(stringifiedNode)
			} else {
				currentNode.Children = append(currentNode.Children, textContent)
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
					stringifiedNode, err := json.Marshal(currentNode)

					if err != nil {
						panic(err)
					}

					if !isFirstNode {
						// If this isn't the first node, add a comma separating it from the previous node
						os.Stdout.Write([]byte{','})
					} else {
						isFirstNode = false
					}
					os.Stdout.Write(stringifiedNode)
				}

				if closingNodeTagName == closedTagName {
					// If the node we just closed matches the name of the closing tag we just read, we're done.
					// Otherwise, keep going up the tree until we find a match or hit the root.
					break
				}
			}

			nodeTree = nodeTree[:nodeTreeLen]
		} else {
			openedTagName, attributes, isVoidElement := cursor.ReadOpeningTag()

			newNode := &TmphNode{
				TagName:    openedTagName,
				Attributes: attributes,
				Children:   nil,
			}

			if isVoidElement {
				// If we're at the root node, write it out
				if currentNode == nil {
					stringifiedNode, err := json.Marshal(newNode)

					if err != nil {
						panic(err)
					}

					if !isFirstNode {
						// If this isn't the first node, add a comma separating it from the previous node
						os.Stdout.Write([]byte{','})
					} else {
						isFirstNode = false
					}
					os.Stdout.Write(stringifiedNode)
				} else {
					currentNode.Children = append(currentNode.Children, newNode)
				}
			} else {
				if openedTagName == "script" || openedTagName == "style" {
					elementTextContent := cursor.ReadToMatchingClosingTag(openedTagName, false)
					if elementTextContent != "" {
						newNode.Children = append(newNode.Children, elementTextContent)

						// Script and style tags should be hoisted to the root, so just write them out
						// right away
						stringifiedNode, err := json.Marshal(newNode)

						if err != nil {
							panic(err)
						}

						if !isFirstNode {
							// If this isn't the first node, add a comma separating it from the previous node
							os.Stdout.Write([]byte{','})
						} else {
							isFirstNode = false
						}
						os.Stdout.Write(stringifiedNode)
					}
				} else {
					if currentNode != nil {
						currentNode.Children = append(currentNode.Children, newNode)
					}

					newNode.Children = make([]interface{}, 0)
					currentNode = newNode
					nodeTree = append(nodeTree, currentNode)
					nodeTreeLen++
				}
			}
		}
	}

	os.Stdout.Write([]byte{']'})
}
