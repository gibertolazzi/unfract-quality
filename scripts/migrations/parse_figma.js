const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/figma_node.json', 'utf8'));
const node = data.nodes['255:288'].document;

function parseNode(n, depth = 0) {
  const indent = '  '.repeat(depth);
  let summary = `${indent}- [${n.type}] ${n.name}`;
  
  if (n.type === 'TEXT') {
    summary += ` ("${n.characters.replace(/\n/g, '\\n')}")`;
    const style = n.style;
    if (style) {
      summary += ` | Font: ${style.fontFamily} ${style.fontWeight}, Size: ${style.fontSize}, Color: ${JSON.stringify(n.fills?.[0]?.color)}`;
    }
  } else {
    // layout info
    if (n.layoutMode) {
      summary += ` | Layout: ${n.layoutMode} (Spacing: ${n.itemSpacing}, Padding: ${n.paddingTop}t ${n.paddingRight}r ${n.paddingBottom}b ${n.paddingLeft}l)`;
    }
    // color info
    if (n.fills && n.fills.length > 0 && n.fills[0].color) {
      const c = n.fills[0].color;
      summary += ` | Fill: rgba(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)}, ${c.a})`;
    }
    if (n.strokes && n.strokes.length > 0 && n.strokes[0].color) {
      const c = n.strokes[0].color;
      summary += ` | Stroke: rgba(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)}, ${c.a})`;
    }
  }
  
  console.log(summary);
  if (n.children) {
    n.children.forEach(c => parseNode(c, depth + 1));
  }
}

parseNode(node);
