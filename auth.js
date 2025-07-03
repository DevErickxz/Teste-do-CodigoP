// auth.js

// Registra um novo usuário em localStorage
function registerUser(username, password) {
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  if (users[username]) {
    throw new Error('Usuário já existe');
  }
  users[username] = password;
  localStorage.setItem('users', JSON.stringify(users));
}

// Faz login; retorna true se credenciais conferirem
function loginUser(username, password) {
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  if (users[username] && users[username] === password) {
    sessionStorage.setItem('loggedInUser', username);
    return true;
  }
  return false;
}

// Verifica sessão ativa
function isLoggedIn() {
  return !!sessionStorage.getItem('loggedInUser');
}

// Desloga e volta para a view de login
function logout() {
  sessionStorage.removeItem('loggedInUser');
  showView('login-view');
}
