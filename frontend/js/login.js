/* ==========================================================
                    SHOW / HIDE PASSWORD
========================================================== */

const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", () => {

    if(password.type === "password"){

        password.type = "text";
        togglePassword.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';

    }

    else{

        password.type = "password";
        togglePassword.innerHTML = '<i class="fa-solid fa-eye"></i>';

    }

});


/* ==========================================================
                    LOGIN FORM
========================================================== */

const form = document.getElementById("loginForm");

form.addEventListener("submit", function(e){

    e.preventDefault();

    const email = document.querySelector('input[type="email"]').value.trim();
    const passwordValue = password.value.trim();

    if(email === "" || passwordValue === ""){

        alert("Please fill in all fields.");
        return;

    }

    const button = form.querySelector("button");

    button.innerHTML = "Logging in...";
    button.disabled = true;

    setTimeout(() => {

        alert("Login Successful!");

        window.location.href = "../index.html";

    },1500);

});