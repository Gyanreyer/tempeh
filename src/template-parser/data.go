package main

import "fmt"

type Attribute struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	Line  int    `json:"l"`
	Col   int    `json:"c"`
}

type Node struct {
	TagName     string       `json:"tagName,omitempty"`
	TextContent string       `json:"textContent,omitempty"`
	Attributes  []*Attribute `json:"attributes,omitempty"`
	Children    []*Node      `json:"children,omitempty"`
	Parent      *Node        `json:"-"` // This field is not serialized
	Line        int          `json:"l"`
	Col         int          `json:"c"`
}

func (n *Node) AddChild(child *Node) {
	child.Parent = n
	n.Children = append(n.Children, child)
}

func (n *Node) AddAttribute(name string, line, col int) {
	n.Attributes = append(n.Attributes, &Attribute{
		Line:  line,
		Col:   col,
		Name:  name,
		Value: "",
	})
}

func (n *Node) UpdateLatestAttributeValue(attrValue string) error {
	attrCount := len(n.Attributes)
	if attrCount == 0 {
		return fmt.Errorf("no attributes found to set value '%s' on", attrValue)
	}

	n.Attributes[attrCount-1].Value = attrValue
	return nil
}

func CreateElementNode(tagName string, line, col int) *Node {
	return &Node{
		Line:     line,
		Col:      col,
		TagName:  tagName,
		Children: []*Node{},
	}
}

func CreateTextNode(textContent string, line, col int) *Node {
	return &Node{
		Line:        line,
		Col:         col,
		TextContent: textContent,
	}
}
