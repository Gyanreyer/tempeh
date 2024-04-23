package main

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"

	gen "github.com/gyanreyer/tempeh/template-parser/pb/gen/go"
	"google.golang.org/protobuf/proto"
)

func main() {
	listener, err := net.Listen("tcp", "localhost:0")

	if err != nil {
		panic(err)
	}

	http.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		parsedTemplateDataBytes, err := parseTemplateFile(r.URL.Query().Get("path"))
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(err.Error()))
		} else {
			w.WriteHeader(http.StatusOK)
			w.Write(parsedTemplateDataBytes)
		}
	})

	defer http.Serve(listener, nil)

	port := listener.Addr().(*net.TCPAddr).Port

	// Write the server's URL origin to stdout so that the parent process can read it
	// and know that the server is ready to receive requests at that address
	os.Stdout.Write([]byte("http://localhost:" + strconv.Itoa(port)))
}

func parseTemplateFile(templateFilePath string) (templateDataBytes []byte, err error) {
	file, err := os.Open(templateFilePath)
	if err != nil {
		return nil, err
	}

	defer file.Close()

	lexer := NewLexer(bufio.NewReader(file))

	go lexer.Run()

	parsedTemplateNodes := make([]*gen.TmphNode, 0, 1)

	currentElementNodeTree := make([]*gen.TmphNode, 0)

	for {
		token := lexer.NextToken()

		if token.tokenType == LT_EOF {
			if len(currentElementNodeTree) > 0 {
				// If there are still unclosed elements, append the top-most element to the root
				parsedTemplateNodes = append(parsedTemplateNodes, currentElementNodeTree[0])
			}
			break
		} else if token.tokenType == LT_ERROR {
			return nil, fmt.Errorf("tempeh template parser encountered fatal error: '%s' at %s:%d:%d", token.tokenValue, templateFilePath, token.line, token.column)
		}

		switch token.tokenType {
		case LT_TEXTCONTENT:
			// Skip text content if it's empty
			if len(token.tokenValue) > 0 {
				textNode := &gen.TmphNode{
					TextContent: &token.tokenValue,
					Line:        uint32(token.line),
					Column:      uint32(token.column),
				}

				currentNodeTreeDepth := len(currentElementNodeTree)
				if currentNodeTreeDepth > 0 {
					parentNode := currentElementNodeTree[currentNodeTreeDepth-1]
					parentNode.ChildNodes = append(parentNode.ChildNodes, textNode)
				} else {
					// Append to the root if there's no parent node
					parsedTemplateNodes = append(parsedTemplateNodes, textNode)
				}
			}
		case LT_OPENINGTAGNAME:
			elementNode := &gen.TmphNode{
				TagName: &token.tokenValue,
				Line:    uint32(token.line),
				Column:  uint32(token.column),
			}

			currentNodeTreeDepth := len(currentElementNodeTree)
			if currentNodeTreeDepth > 0 {
				parentNode := currentElementNodeTree[currentNodeTreeDepth-1]
				parentNode.ChildNodes = append(parentNode.ChildNodes, elementNode)
			}
			currentElementNodeTree = append(currentElementNodeTree, elementNode)
		case LT_ATTRIBUTENAME:
			currentNodeTreeDepth := len(currentElementNodeTree)
			if currentNodeTreeDepth == 0 {
				break
			}
			currentNode := currentElementNodeTree[currentNodeTreeDepth-1]
			currentNode.Attributes = append(currentNode.Attributes, &gen.Attribute{
				Name:   token.tokenValue,
				Line:   uint32(token.line),
				Column: uint32(token.column),
			})
		case LT_ATTRIBUTEVALUE:
			currentNode := currentElementNodeTree[len(currentElementNodeTree)-1]
			if currentNode == nil {
				break
			}

			currentAttributeCount := len(currentNode.Attributes)
			if currentAttributeCount == 0 {
				break
			}

			currentAttribute := currentNode.Attributes[currentAttributeCount-1]
			currentAttribute.Value = token.tokenValue
		case LT_SELFCLOSINGTAGEND:
			currentNodeTreeDepth := len(currentElementNodeTree)

			if currentNodeTreeDepth > 0 {
				closedNode := currentElementNodeTree[currentNodeTreeDepth-1]
				parsedTemplateNodes = append(parsedTemplateNodes, closedNode)

				currentElementNodeTree = currentElementNodeTree[:currentNodeTreeDepth-1]
			}
		case LT_CLOSINGTAGNAME:
			closedTagName := token.tokenValue

			for i := len(currentElementNodeTree) - 1; i >= 0; i-- {
				node := currentElementNodeTree[i]
				if *node.TagName == closedTagName {
					parsedTemplateNodes = append(parsedTemplateNodes, node)

					currentElementNodeTree = currentElementNodeTree[:i]
					break
				}
			}
		}
	}

	templateDataBytes, err = proto.Marshal(&gen.TemplateData{
		Src:   templateFilePath,
		Nodes: parsedTemplateNodes,
	})

	if err != nil {
		return nil, err
	}

	return templateDataBytes, nil
}
