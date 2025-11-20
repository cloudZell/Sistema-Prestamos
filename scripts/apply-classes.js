const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'vistas');

function addClass(tagMatch, code, className) {
  // replace opening tag <tag ...> that doesn't already contain class attr
  const regex = new RegExp(`(<${tagMatch}[^>]*)(>)`, 'gi');
  return code.replace(regex, (m, open, close) => {
    if (/\bclass\s*=/.test(open)) return open + close;
    return `${open} class="${className}"${close}`;
  });
}

function addClassToButtons(code) {
  // add class btn to <button ...> without class
  return code.replace(/(<button\b)([^>]*)(>)/gi, (m, start, attrs, close) => {
    if (/\bclass\s*=/.test(attrs)) return start + attrs + close;
    return `${start}${attrs} class="btn"${close}`;
  });
}

function addTableClasses(code) {
  // add class table to tables without class; if id contains 'admin' add table-admin too
  return code.replace(/(<table\b)([^>]*)(>)/gi, (m, start, attrs, close) => {
    if (/\bclass\s*=/.test(attrs)) return start + attrs + close;
    const idMatch = /id\s*=\s*"([^"]+)"/i.exec(attrs);
    let classes = 'table';
    if (idMatch && /admin/i.test(idMatch[1])) classes += ' table-admin';
    return `${start}${attrs} class="${classes}"${close}`;
  });
}

function wrapFormGroups(code) {
  // For each form, wrap label+input/select/textarea pairs into a div.form-group if they are direct siblings
  return code.replace(/(<form[\s\S]*?>)([\s\S]*?)(<\/form>)/gi, (m, open, inner, close) => {
    // process inner: find sequences label + (input|select|textarea)
    let out = inner.replace(/(\s*<label[\s\S]*?<\/label>\s*)(<input[\s\S]*?>|<select[\s\S]*?>[\s\S]*?<\/select>|<textarea[\s\S]*?<\/textarea>)/gi, (m2, label, field) => {
      return `\n<div class="form-group">\n${label}\n${field}\n</div>\n`;
    });
    return open + out + close;
  });
}

function processFile(filePath){
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // header -> cabecera
  code = addClass('header', code, 'cabecera');
  // main -> contenedor
  code = addClass('main', code, 'contenedor');
  // section -> card (only if section lacks class and contains h2 or table)
  code = code.replace(/(<section\b)([^>]*)(>)([\s\S]*?)(<\/section>)/gi, (m, start, attrs, close, inner, end) => {
    if (/\bclass\s*=/.test(attrs)) return m;
    if (/\<h[12]\b|\<table\b/.test(inner)) {
      return `${start}${attrs} class="card"${close}${inner}${end}`;
    }
    return m;
  });

  // add form-group wrappers
  code = wrapFormGroups(code);

  // add btn to buttons
  code = addClassToButtons(code);

  // add table classes
  code = addTableClasses(code);

  // ensure links to highlight helper exist (if not already) - add before </body>
  if (!/highlight-no-class\.js/.test(code)){
    code = code.replace(/<script\s+src="\/public\/[^"]+"><\/script>\s*<\/body>/i, match => match.replace('</script>', '</script>\n  <script src="/public/js/highlight-no-class.js"></script>'));
    // fallback if previous pattern didn't match
    if (!/highlight-no-class\.js/.test(code)){
      code = code.replace(/<\/body>/i, '  <script src="/public/js/highlight-no-class.js"></script>\n</body>');
    }
  }

  if (code !== original) {
    fs.writeFileSync(filePath, code, 'utf8');
    return true;
  }
  return false;
}

const files = fs.readdirSync(DIR).filter(f=>f.endsWith('.html'));
let changed = [];
files.forEach(f=>{
  const fp = path.join(DIR,f);
  if (processFile(fp)) changed.push(f);
});
console.log('Processed', files.length, 'files. Changed:', changed.join(', '));
