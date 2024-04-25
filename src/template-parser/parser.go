package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
)

func parseTemplateFile(templateFilePath string) (templateDataBytes []byte, err error) {
	file, err := os.Open(templateFilePath)
	if err != nil {
		return nil, err
	}

	defer file.Close()

	lexer := NewLexer(bufio.NewReader(file))

	go lexer.Run()

	templateData := CreateTemplateData(templateFilePath)

	// Track the current lowest-level leaf element node which we are parsing inside of.
	// Any new text content or element nodes will be appended to this node.
	// Once this node is closed, we will shift back up to the parent node.
	// If there is no parent node, the leaf node will be appended to the root of the parsed template nodes.
	var currentOpenLeafElementNode *Node = nil

	for {
		token := lexer.NextToken()

		if token.tokenType == LT_EOF {
			if currentOpenLeafElementNode != nil {
				// If there are unclosed nodes, traverse up to the root node and append it to the template data
				openRootNode := currentOpenLeafElementNode
				for openRootNode.Parent != nil {
					openRootNode = openRootNode.Parent
				}
				templateData.AddNode(openRootNode)
			}
			break
		} else if token.tokenType == LT_ERROR {
			return nil, fmt.Errorf("tempeh template parser encountered fatal error: '%s' at %s:%d:%d", token.tokenValue, templateFilePath, token.line, token.column)
		}

		switch token.tokenType {
		case LT_TEXTCONTENT:
			// Skip text content if it's empty
			if len(token.tokenValue) == 0 {
				break
			}

			textNode := CreateTextNode(token.tokenValue, token.line, token.column)

			if currentOpenLeafElementNode != nil {
				currentOpenLeafElementNode.AddChild(textNode)
			} else {
				// Append to the root if there's no parent node
				templateData.AddNode(textNode)
			}
		case LT_OPENINGTAGNAME:
			elementNode := CreateElementNode(token.tokenValue, token.line, token.column)

			if currentOpenLeafElementNode != nil {
				currentOpenLeafElementNode.AddChild(elementNode)
			}
			currentOpenLeafElementNode = elementNode
		case LT_ATTRIBUTENAME:
			if currentOpenLeafElementNode == nil {
				break
			}
			currentOpenLeafElementNode.AddAttribute(token.tokenValue, token.line, token.column)
		case LT_ATTRIBUTEVALUE:
			if currentOpenLeafElementNode == nil {
				break
			}

			err = currentOpenLeafElementNode.UpdateLatestAttributeValue(token.tokenValue)
			if err != nil {
				return nil, fmt.Errorf("tempeh template parser encountered fatal error: '%s' at %s:%d:%d", err.Error(), templateFilePath, token.line, token.column)
			}
		case LT_SELFCLOSINGTAGEND:
			if currentOpenLeafElementNode == nil {
				break
			}

			if currentOpenLeafElementNode.Parent != nil {
				currentOpenLeafElementNode = currentOpenLeafElementNode.Parent
			} else {
				templateData.AddNode(currentOpenLeafElementNode)
				currentOpenLeafElementNode = nil
			}
		case LT_CLOSINGTAGNAME:
			if currentOpenLeafElementNode == nil {
				break
			}

			closedTagName := token.tokenValue

			closedNode := currentOpenLeafElementNode

			for closedNode != nil && closedNode.TagName != closedTagName {
				closedNode = currentOpenLeafElementNode.Parent
			}

			if closedNode == nil {
				return nil, fmt.Errorf("tempeh template parser encountered fatal error: unexpected closing tag '%s' at %s:%d:%d", closedTagName, templateFilePath, token.line, token.column)
			}

			if closedNode.Parent != nil {
				currentOpenLeafElementNode = closedNode.Parent
			} else {
				templateData.AddNode(closedNode)
				currentOpenLeafElementNode = nil
			}
		}
	}

	templateDataBytes, err = json.Marshal(templateData)

	if err != nil {
		return nil, err
	}

	return templateDataBytes, nil
}
