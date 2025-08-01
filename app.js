const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Pasta de uploads
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'video/mp4'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido.'));
  }
});

// Arquivo de dados do carrossel
const CAROUSEL_FILE = path.join(__dirname, 'carousel_data.json');
function readCarousel() {
  if (!fs.existsSync(CAROUSEL_FILE)) return [];
  return JSON.parse(fs.readFileSync(CAROUSEL_FILE));
}
function saveCarousel(data) {
  fs.writeFileSync(CAROUSEL_FILE, JSON.stringify(data, null, 2));
}

// Middlewares
app.use('/uploads', express.static(UPLOADS));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'segredo', resave: false, saveUninitialized: false }));

// Credenciais de admin
const ADMIN_USER = "admin";
const ADMIN_PASS_HASH = bcrypt.hashSync("admin123", 10);

// Middleware de autenticação
function auth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login');
}

// Rota raiz
app.get('/', (req, res) => {
  res.redirect('/login'); // Redireciona diretamente para o login
});

// Rotas
app.get('/login', (req, res) => {
  res.send('<form method="POST"><input name="user"/><input type="password" name="pass"/><button>Entrar</button></form>');
});

app.post('/login', (req, res) => {
  const { user, pass } = req.body;
  if (user === ADMIN_USER && bcrypt.compareSync(pass, ADMIN_PASS_HASH)) {
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else res.send('Login inválido.');
});

app.get('/admin', auth, (req, res) => {
  const items = readCarousel();
  res.send(`<form method="POST" enctype="multipart/form-data" action="/admin/upload">
    <input type="file" name="media"/>
    <input name="caption"/>
    <button>Enviar</button>
  </form>${
    items.map((item, i) => `<div>${item.caption} - <a href="/admin/remove?i=${i}">Remover</a></div>`).join('')
  }`);
});

app.post('/admin/upload', auth, upload.single('media'), (req, res) => {
  const data = readCarousel();
  data.push({ url: '/uploads/' + req.file.filename, type: req.file.mimetype, caption: req.body.caption || "" });
  saveCarousel(data);
  res.redirect('/admin');
});

app.get('/admin/remove', auth, (req, res) => {
  const data = readCarousel();
  const i = parseInt(req.query.i);
  if (data[i]) {
    const f = path.join(UPLOADS, path.basename(data[i].url));
    if (fs.existsSync(f)) fs.unlinkSync(f);
    data.splice(i, 1);
    saveCarousel(data);
  }
  res.redirect('/admin');
});

// Inicializa o servidor
app.listen(PORT, () => console.log('Rodando em http://localhost:' + PORT));
