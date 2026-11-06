CareSphere - NGO Management Platform

CareSphere is a full-stack web-based NGO management platform designed to simplify and centralise volunteer management, event coordination, applications, certificates and organisational activities.

The platform provides a public website, a dedicated volunteer dashboard and an administrative panel, bringing multiple NGO operations together in one system.

PROJECT OVERVIEW

CareSphere aims to replace manual record-keeping through spreadsheets, paper forms and emails with a centralised digital management system.

The platform supports three programme areas:
- Education
- Healthcare
- Green Cover

It is designed around a volunteer-run foundation operating across six districts of Karnataka.

KEY FEATURES

Public Website
- Organisation information and programme details.
- Events and news updates.
- Live impact dashboard with statistics and charts.
- Volunteer registration and applications.
- Contact and newsletter forms.
- Partnership requests.
- Testimonials and Hall of Fame.

Volunteer Dashboard
- Volunteer profile and application management.
- Event registration and waiting lists.
- Volunteer hour logging.
- Certificate requests and downloads.
- Proof document uploads.
- Request to become an administrator.

Admin Panel
- Volunteer application approval and management.
- Volunteer directory.
- Volunteer hour verification.
- Event creation and registration management.
- Certificate approval and generation.
- News and testimonial management.
- Donations and partnership management.
- Contact messages and newsletter management.
- Impact statistics and organisational settings.
- Administrator account and role management.

ROLE-BASED ACCESS CONTROL

The system supports three user roles:

1. Super Admin: Full administrative access, account management and final decisions on administrator promotions.
2. Admin: Manages volunteers, events, applications, certificates and organisational activities.
3. Volunteer: Registers for events, records hours, requests certificates and manages their profile.

TECHNOLOGY STACK

Frontend: HTML5, CSS3, JavaScript (ES6)
Backend: Python
Framework: FastAPI
Database: PostgreSQL 16
ORM: SQLAlchemy 2.0
Validation: Pydantic 2
Authentication: JWT
Password Security: bcrypt
Database Migrations: Alembic
ASGI Server: Uvicorn
Database Driver: psycopg2-binary
Charts: Chart.js
API Documentation: Swagger UI

SYSTEM ARCHITECTURE

CareSphere follows a three-tier client-server architecture:

1. Presentation Tier: HTML, CSS and JavaScript provide the public website, volunteer dashboard and admin panel.
2. Application Tier: FastAPI handles API requests, validation, authentication, authorisation and business logic.
3. Data Tier: PostgreSQL stores application data, while uploaded files are maintained in the backend uploads directory.

The system includes 22 application database tables and approximately 70 API endpoints.

SECURITY FEATURES

- Password hashing using bcrypt.
- JWT-based authentication.
- Role-based authorisation.
- Server-side validation using Pydantic.
- Secure file uploads with file type, content and size validation.
- Database constraints to maintain data integrity.
- Protected administrative operations.

IMPORTANT WORKFLOWS

- Volunteer applications are reviewed and approved by administrators.
- Event registrations automatically support waiting lists.
- Volunteer hours require administrative verification.
- Certificates are issued based on eligibility and supporting evidence.
- Administrator promotion follows seven eligibility rules, two admin endorsements and a final Super Admin interview.
- Public impact statistics are calculated directly from database records wherever applicable.

PROJECT STRUCTURE

CareSphere/
│
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   ├── security.py
│   │   └── config.py
│   ├── alembic/
│   ├── uploads/
│   ├── requirements.txt
│   └── seed.py
│
├── frontend/
│   ├── html/
│   ├── css/
│   └── js/
│
├── adminside/
│   └── frontend/
│       ├── html/
│       ├── css/
│       └── js/
│
├── docs/
└── README.md

INSTALLATION AND SETUP

Prerequisites
- Python 3.10 or above
- PostgreSQL 16
- Visual Studio Code
- VS Code Live Server extension

1. Clone the Repository

git clone https://github.com/azzeeenn/CareSphere.git
cd CareSphere

2. Set Up the Backend

cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

3. Configure the Database

Create the PostgreSQL database named caresphere and configure the database connection and required environment variables in the backend configuration.

4. Run Database Migrations

alembic upgrade head

5. Initialise Sample Data

python seed.py

6. Start the Backend Server

uvicorn app.main:app --reload

Backend API: http://127.0.0.1:8000

Interactive API documentation: http://127.0.0.1:8000/docs

7. Run the Frontend

Open the frontend HTML files using the VS Code Live Server extension.

The frontend development server runs on port 5500.

TESTING

The application was tested using:

- Unit testing of individual functions.
- API testing through FastAPI Swagger UI.
- Integration testing of frontend and backend workflows.
- Database testing using PostgreSQL and pgAdmin.
- System testing across different user roles.
- Compatibility testing using Chrome, Edge and Firefox.

FUTURE ENHANCEMENTS

- Online donation payment gateway integration.
- Automated email notifications.
- QR-code-based certificate verification.
- Password reset and refresh token functionality.
- Cloud deployment.
- Automated testing using pytest.
- Dedicated mobile application.
- Downloadable reports and analytics.
- Kannada language support.
- Administrative audit logs.

CURRENT PROJECT SCOPE

The application is developed and demonstrated in a local environment. Online payment processing, automated email notifications and public cloud deployment are not included in the current version.

PROJECT REPOSITORY

CareSphere - NGO and Volunteer Management Website

GitHub: https://github.com/azzeeenn/CareSphere
