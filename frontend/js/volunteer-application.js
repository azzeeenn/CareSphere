/* ==========================================================
                STEP ELEMENTS
========================================================== */

const form = document.getElementById("applicationForm");

const steps = document.querySelectorAll(".form-step");

const nextButtons = document.querySelectorAll(".next-btn");

const prevButtons = document.querySelectorAll(".prev-btn");

const progressFill = document.querySelector(".progress-fill");

const stepText = document.querySelector(".step-text");

const successModal = document.getElementById("successModal");

let currentStep = 0;

const totalSteps = steps.length;

/* ==========================================================
                INITIALIZE
========================================================== */

showStep(currentStep);

/* ==========================================================
                SHOW STEP
========================================================== */

function showStep(step){

    steps.forEach((section)=>{

        section.classList.remove("active");

    });

    steps[step].classList.add("active");

    updateProgress();

    const anchor = document.querySelector(".progress-section");

    window.scrollTo({

        top: anchor ? anchor.offsetTop - 100 : 0,

        behavior:"smooth"

    });

}

/* ==========================================================
                UPDATE PROGRESS BAR
========================================================== */

function updateProgress(){

    const percentage=((currentStep+1)/totalSteps)*100;

    progressFill.style.width=`${percentage}%`;

    /* Update the spans instead of replacing the whole block -
       stepText.textContent used to delete #currentStep/#totalSteps. */

    const currentLabel = document.getElementById("currentStep");
    const totalLabel = document.getElementById("totalSteps");

    if(currentLabel){

        currentLabel.textContent = currentStep+1;

    }

    if(totalLabel){

        totalLabel.textContent = totalSteps;

    }

    progressFill.parentElement.setAttribute("aria-valuenow", Math.round(percentage));

}

/* ==========================================================
                NEXT BUTTONS
========================================================== */

nextButtons.forEach((button)=>{

    button.addEventListener("click",()=>{

        if(validateStep(currentStep)){

            currentStep++;

            showStep(currentStep);

        }

    });

});

/* ==========================================================
                PREVIOUS BUTTONS
========================================================== */

prevButtons.forEach((button)=>{

    button.addEventListener("click",()=>{

        if(currentStep>0){

            currentStep--;

            showStep(currentStep);

        }

    });

});
/* ==========================================================
                STEP VALIDATION
========================================================== */

function validateStep(step){

    const currentSection = steps[step];

    const requiredFields = currentSection.querySelectorAll("[required]");

    let valid = true;

    requiredFields.forEach((field)=>{

        if(field.type==="radio"){

            const radioGroup = currentSection.querySelectorAll(`input[name="${field.name}"]`);

            const checked = Array.from(radioGroup).some(radio=>radio.checked);

            if(!checked){

                valid = false;

                radioGroup.forEach(radio=>{

                    radio.parentElement.style.borderColor="#E78F81";

                });

            }else{

                radioGroup.forEach(radio=>{

                    radio.parentElement.style.borderColor="#ECECEC";

                });

            }

            return;

        }

        if(field.type==="checkbox"){

            if(!field.checked){

                valid = false;

                field.parentElement.style.color="#E78F81";

            }else{

                field.parentElement.style.color="";

            }

            return;

        }

        if(field.value.trim()===""){

            valid = false;

            field.style.borderColor="#E78F81";

            field.focus();

        }else{

            field.style.borderColor="#E5E7EB";

        }

    });

    return valid;

}

/* ==========================================================
                LIVE VALIDATION
========================================================== */

const allInputs = document.querySelectorAll(

    "input, textarea, select"

);

allInputs.forEach((input)=>{

    input.addEventListener("input",()=>{

        input.style.borderColor="#E5E7EB";

    });

    input.addEventListener("change",()=>{

        input.style.borderColor="#E5E7EB";

    });

});

/* ==========================================================
                PASSWORD VALIDATION
========================================================== */

function passwordsMatch(){

    const password = document.getElementById("password");

    const confirmPassword = document.getElementById("confirm_password");

    if(!password || !confirmPassword){

        return true;

    }

    if(password.value !== confirmPassword.value){

        confirmPassword.setCustomValidity("Passwords do not match");

        confirmPassword.style.borderColor="#E78F81";

        return false;

    }

    confirmPassword.setCustomValidity("");

    confirmPassword.style.borderColor="#E5E7EB";

    return true;

}

const password = document.getElementById("password");

const confirmPassword = document.getElementById("confirm_password");

if(password && confirmPassword){

    password.addEventListener("input",passwordsMatch);

    confirmPassword.addEventListener("input",passwordsMatch);

}
/* ==========================================================
                FORM SUBMISSION
========================================================== */

form.addEventListener("submit", async (event)=>{

    event.preventDefault();

    if(!validateStep(currentStep)){

        return;

    }

    if(!passwordsMatch()){

        confirmPassword.focus();

        return;

    }

    const formData = new FormData(form);

    try{

        /*
        ======================================================
        BACKEND INTEGRATION (FastAPI)

        Replace the URL below with your API endpoint later.

        Example:
        http://127.0.0.1:8000/volunteers/apply
        ======================================================
        */

        /*
        const response = await fetch("http://127.0.0.1:8000/volunteers/apply",{

            method:"POST",

            body:formData

        });

        if(!response.ok){

            throw new Error("Application submission failed.");

        }
        */

        successModal.classList.add("show");

        form.reset();

        currentStep = 0;

        showStep(currentStep);

    }

    catch(error){

        console.error(error);

        alert("Something went wrong. Please try again.");

    }

});

/* ==========================================================
                SUCCESS MODAL
========================================================== */

const homeButton = document.querySelector(".home-btn");

if(homeButton){

    homeButton.addEventListener("click",()=>{

        successModal.classList.remove("show");

    });

}

window.addEventListener("click",(event)=>{

    if(event.target===successModal){

        successModal.classList.remove("show");

    }

});

/* ==========================================================
                PREVENT ENTER KEY FROM
                ACCIDENTALLY SUBMITTING
========================================================== */

form.addEventListener("keydown",(event)=>{

    if(event.key==="Enter" && event.target.tagName!=="TEXTAREA"){

        event.preventDefault();

    }

});

/* ==========================================================
                FILE PREVIEW VALIDATION
========================================================== */

const profilePhoto = document.getElementById("profile_photo");

if(profilePhoto){

    profilePhoto.addEventListener("change",()=>{

        const file = profilePhoto.files[0];

        if(!file){

            return;

        }

        const allowedTypes=[

            "image/jpeg",

            "image/jpg",

            "image/png",

            "image/webp"

        ];

        if(!allowedTypes.includes(file.type)){

            alert("Please upload a JPG, PNG, or WEBP image.");

            profilePhoto.value="";

            return;

        }

        const maxSize=2*1024*1024;

        if(file.size>maxSize){

            alert("Image size should be less than 2 MB.");

            profilePhoto.value="";

        }

    });

}

/* ==========================================================
                END OF FILE
========================================================== */