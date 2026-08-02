// Собирает index.html + styles.css + js/* (включая js/vendor/*) в один
// самодостаточный HTML-файл — «финансовый-аудит.html» — открывается
// двойным кликом, без сервера. Запускать из корня репозитория: node build-single.js
const fs = require('fs');
const path = require('path');
const repo = __dirname;

let html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(repo, 'styles.css'), 'utf8');

html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>');
html = html.replace(/<script src="js\/([\w./-]+)"><\/script>/g, (m, f) => {
  const code = fs.readFileSync(path.join(repo, 'js', f), 'utf8');
  return '<script>\n' + code + '\n</script>';
});

fs.writeFileSync(path.join(repo, 'финансовый-аудит.html'), html);
console.log('OK: финансовый-аудит.html,', Math.round(html.length / 1024), 'KB');
