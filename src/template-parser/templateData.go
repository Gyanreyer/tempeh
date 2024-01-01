package main

type RenderAttribute struct {
	AttributeName     string `json:"name"`
	AttributeModifier string `json:"modifier,omitempty"`
	ExpressionValue   string `json:"expressionValue,omitempty"`
	Line              int    `json:"line"`
	Column            int    `json:"column"`
}

type StaticAttribute struct {
	AttributeName  string `json:"name"`
	AttributeValue string `json:"value,omitempty"`
	Line           int    `json:"line"`
	Column         int    `json:"column"`
}

type TmphNode struct {
	TagName          string             `json:"tagName,omitempty"`
	StaticAttributes []*StaticAttribute `json:"staticAttributes,omitempty"`
	RenderAttributes []*RenderAttribute `json:"renderAttributes,omitempty"`
	Children         []*TmphNode        `json:"children,omitempty"`
	TextContent      string             `json:"textContent,omitempty"`
	Line             int                `json:"line"`
	Column           int                `json:"column"`
}

func (node *TmphNode) AppendChild(child *TmphNode) {
	node.Children = append(node.Children, child)
}

func NewElementNode(tagName string, childNodes []*TmphNode, staticAttributes []*StaticAttribute, renderAttributes []*RenderAttribute, line int, column int) *TmphNode {
	return &TmphNode{
		TagName:          tagName,
		StaticAttributes: staticAttributes,
		RenderAttributes: renderAttributes,
		Children:         childNodes,
		Line:             line,
		Column:           column,
	}
}

func NewTextNode(textContent string, line int, column int) *TmphNode {
	return &TmphNode{
		TextContent: textContent,
		Line:        line,
		Column:      column,
	}
}

func NewRootNode(tagName string, childNodes []*TmphNode, line int, column int) *TmphNode {
	return &TmphNode{
		TagName:  tagName,
		Children: childNodes,
		Line:     line,
		Column:   column,
	}
}
