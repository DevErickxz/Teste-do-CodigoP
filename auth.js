// auth.js

// Cadastro de usuário (email e senha)
function registerUser(email, password) {
  return firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(userCredential => userCredential.user)
    .catch(error => { throw error; });
}

// Login de usuário (email e senha)
function loginUser(email, password) {
  return firebase.auth().signInWithEmailAndPassword(email, password)
    .then(userCredential => userCredential.user)
    .catch(error => { throw error; });
}

// Verifica se está logado
function isLoggedIn() {
  return !!firebase.auth().currentUser;
}

// Logout
function logout() {
  localStorage.removeItem('savedArea');
  localStorage.removeItem('savedSide');
  firebase.auth().signOut().then(() => location.reload());
}
