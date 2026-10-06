const fs = require('fs');

const html = fs.readFileSync('app/index.html', 'utf8');
const lines = html.split('\n');

const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

// Simple tag tokenizer
const tagRegex = /<\/?([a-zA-Z0-9-]+)(?:\s+[^>]*)?>/g;
let match;
const stack = [];

for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let tagMatch;
    const lineTagRegex = /<(\/?)([a-zA-Z0-9-]+)([^>]*)>/g;
    while ((tagMatch = lineTagRegex.exec(line)) !== null) {
        const isClosing = tagMatch[1] === '/';
        const tagName = tagMatch[2].toLowerCase();
        const attrs = tagMatch[3];
        const isSelfClosing = attrs.trim().endsWith('/') || voidElements.has(tagName);

        if (voidElements.has(tagName) || isSelfClosing) {
            continue;
        }

        const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
        const id = idMatch ? idMatch[1] : '';
        const classMatch = attrs.match(/\bclass=["']([^"']+)["']/i);
        const className = classMatch ? classMatch[1] : '';

        if (!isClosing) {
            stack.push({
                line: lineIdx + 1,
                tag: tagName,
                id,
                className
            });
        } else {
            // Find last matching tag in stack
            let foundIdx = -1;
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].tag === tagName) {
                    foundIdx = i;
                    break;
                }
            }
            if (foundIdx !== -1) {
                // If there are unclosed tags between foundIdx and top of stack, report them
                if (foundIdx < stack.length - 1) {
                    const unclosed = stack.slice(foundIdx + 1);
                    console.log(`⚠️ Line ${lineIdx + 1}: Closing </${tagName}>, but unclosed tags inside:`, unclosed.map(u => `${u.tag}#${u.id || ''}.${u.className || ''} (line ${u.line})`));
                }
                stack.splice(foundIdx);
            } else {
                console.log(`⚠️ Line ${lineIdx + 1}: Unexpected closing </${tagName}> with no opening tag!`);
            }
        }
    }
}

console.log('\n--- UNCLOSED TAGS AT END OF FILE ---');
console.log(stack.map(u => `${u.tag}#${u.id || ''}.${u.className || ''} (line ${u.line})`));
