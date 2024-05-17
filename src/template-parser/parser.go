package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func parseTemplateFile(templateFilePath string, responseWriter *http.ResponseWriter) error {
	file, err := os.Open(templateFilePath)
	if err != nil {
		return err
	}

	defer file.Close()

	responseController := http.NewResponseController(*responseWriter)

	// Track whether we should add a comma before writing the next node to the response to keep the JSON array valid
	shouldAddComma := false

	buf := new(bytes.Buffer)

	var writeNodeToResponse = func(node *Node) error {
		// Clear the buffer once we're done writing
		defer buf.Reset()

		if shouldAddComma {
			if _, err := buf.WriteRune(','); err != nil {
				return err
			}
		} else {
			shouldAddComma = true
		}
		jsonBytes, err := json.Marshal(node)
		if err != nil {
			return err
		}
		if _, err := buf.Write(jsonBytes); err != nil {
			return err
		}
		if _, err := buf.WriteTo(*responseWriter); err != nil {
			return err
		}
		if err := responseController.Flush(); err != nil {
			return err
		}
		return nil
	}

	var writeRuneToResponse = func(r rune) error {
		defer buf.Reset()

		if _, err := buf.WriteRune(r); err != nil {
			return err
		}
		if _, err := buf.WriteTo(*responseWriter); err != nil {
			return err
		}
		if err := responseController.Flush(); err != nil {
			return err
		}
		return nil
	}

	// Write an opening bracket to indicate the start of the JSON array
	if err := writeRuneToResponse('['); err != nil {
		return err
	}

	lexer := NewLexer(bufio.NewReader(file))

	go lexer.Run()

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
				err = writeNodeToResponse(openRootNode)
				if err != nil {
					return fmt.Errorf("tempeh template parser encountered fatal error: '%s' at %s:%d:%d", err.Error(), templateFilePath, token.line, token.column)
				}
			}
			break
		} else if token.tokenType == LT_ERROR {
			return fmt.Errorf("tempeh template parser encountered fatal error: '%s' at %s:%d:%d", token.tokenValue, templateFilePath, token.line, token.column)
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
				err = writeNodeToResponse(textNode)
				if err != nil {
					return fmt.Errorf("tempeh template parser encountered fatal error: '%s' at %s:%d:%d", err.Error(), templateFilePath, token.line, token.column)
				}
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
				return fmt.Errorf("tempeh template parser encountered fatal error: '%s' at %s:%d:%d", err.Error(), templateFilePath, token.line, token.column)
			}
		case LT_SELFCLOSINGTAGEND:
			if currentOpenLeafElementNode == nil {
				break
			}

			if currentOpenLeafElementNode.Parent != nil {
				currentOpenLeafElementNode = currentOpenLeafElementNode.Parent
			} else {
				err = writeNodeToResponse(currentOpenLeafElementNode)
				currentOpenLeafElementNode = nil
				if err != nil {
					return fmt.Errorf("tempeh template parser encountered fatal error: '%s' at %s:%d:%d", err.Error(), templateFilePath, token.line, token.column)
				}
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
				return fmt.Errorf("tempeh template parser encountered fatal error: unexpected closing tag '%s' at %s:%d:%d", closedTagName, templateFilePath, token.line, token.column)
			}

			if closedNode.Parent != nil {
				currentOpenLeafElementNode = closedNode.Parent
			} else {
				err = writeNodeToResponse(closedNode)
				currentOpenLeafElementNode = nil
				if err != nil {
					return fmt.Errorf("tempeh template parser encountered fatal error: '%s' at %s:%d:%d", err.Error(), templateFilePath, token.line, token.column)
				}
			}
		}
	}

	// Write a closing bracket to indicate the end of the JSON array
	if err := writeRuneToResponse(']'); err != nil {
		return err
	}

	return nil
}
