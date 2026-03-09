
# Mini Market API

API for managing users, roles, and wallets. Built with NestJS, TypeORM, and PostgreSQL.


## Installation

1. Clone the repository:

```bash
git clone (repo_url)
cd mini_market
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file (or `.env.example` for a template) with your environment variables:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=alihan2007
DB_NAME=mini_market
JWT_SECRET_KEY=your_secret_key
JWT_EXPIRE_IN=1d
```

## Docker 

Run the project using Docker:

```bash
docker-compose up -d
```

Containers:

API — port 3000
PostgreSQL — port 5432


## Admin Seed

To create an admin user manually:
```bash
npm run seed:admin
```

This will create a user with the following credentials:

name: admin
password: 123456
role: ADMIN

> **Note** Regular user registration defaults to `USER` role. No one can become an admin by passing a role in registration.

---

## Local Development

Run the project locally:

```bash
cd mini_market
npm run start:dev
```

API will be available at `http://localhost:3000`.

Make sure no other process (like Docker) is using port 3000 if running locally.


##  Testing

* Unit tests:

```bash
npm run test
```

* End-to-end tests:
```bash
npm run test:e2e
```


##  User Roles


 USER - Regular user                 
 ADMIN - Administrator                
 SELLER - Seller  

---

## Tips

* For security, do not store real passwords in `.env.example`.
* Admin seed is only required once; you can remove the seed script after first run or leave it for testing.
* Docker ensures the same environment on all machines.


