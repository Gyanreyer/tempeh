package main

import (
	"encoding/json"
	"flag"
	"os"
)

type TmphNode struct {
	TagName    string
	Attributes AttributeArray
	Children   []any
}

func main() {
	filePath := flag.String("file", "", "Path to XML file to parse")
	flag.Parse()

	if *filePath == "" {
		panic("No file path provided")
	}

	fileBytes, err := os.ReadFile(*filePath)
	if err != nil {
		panic(err)
	}

	fileStr := string(fileBytes)

	cursor := Cursor{index: 0, str: fileStr, maxIndex: len(fileStr) - 1}

	rootNode := TmphNode{
		TagName:    "",
		Attributes: nil,
		Children:   make([]any, 0),
	}

	nodeTree := make([]*TmphNode, 0)

	for cursor.index < cursor.maxIndex {
		currentNode := &rootNode

		nodeTreeLen := len(nodeTree)
		if nodeTreeLen >= 1 {
			currentNode = nodeTree[nodeTreeLen-1]
		}

		shouldPreserveWhitespace := false

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
			currentNode.Children = append(currentNode.Children, textContent)
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
				nodeTree = nodeTree[:nodeTreeLen]
				if nodeTreeLen >= 1 {
					currentNode = nodeTree[nodeTreeLen-1]
				} else {
					currentNode = &rootNode
				}

				if closingNodeTagName == closedTagName {
					// If the node we just closed matches the name of the closing tag we just read, we're done.
					// Otherwise, keep going up the tree until we find a match or hit the root.
					break
				}
			}
		} else {
			openedTagName, attributes, isVoidElement := cursor.ReadOpeningTag()

			newNode := &TmphNode{
				TagName:    openedTagName,
				Attributes: attributes,
				Children:   nil,
			}
			currentNode.Children = append(currentNode.Children, newNode)

			if !isVoidElement {

				if openedTagName == "script" || openedTagName == "style" {
					elementTextContent := cursor.ReadToMatchingClosingTag(openedTagName, false)
					if elementTextContent != "" {
						newNode.Children = append(newNode.Children, elementTextContent)
					}
				} else {
					newNode.Children = make([]any, 0)
					currentNode = newNode
					nodeTree = append(nodeTree, currentNode)
					nodeTreeLen++
				}
			}
		}
	}

	stringifiedRoot, err := json.Marshal(rootNode.Children)
	if err != nil {
		panic(err)
	}

	os.Stdout.Write(stringifiedRoot)
}
