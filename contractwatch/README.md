# ContractWatch backend

Spring Boot REST API for managing contracts, renewal actions, dashboard metrics, and discount offers.

## Run locally

Requires Java 17 or newer and Maven. From this directory:

```powershell
mvn spring-boot:run
```

If Maven reports that its configured local repository is not writable, use a project-local dependency cache:

```powershell
mvn -Dmaven.repo.local=.m2/repository spring-boot:run
```

The application starts at `http://localhost:8080`. By default it uses a local file-backed H2 database in `./data/contractwatch`, which persists between restarts.

## Frontend

The HTML, CSS, and JavaScript frontend is in `src/main/resources/static/`. Spring Boot serves it at `http://localhost:8080/`; there is no separate frontend build step. The sign-in screen is a visual prototype and accepts any non-empty email/password; authentication is not implemented by this backend. Contract views connect to the REST API when it is running and use browser demo data otherwise. The document library currently stores uploaded files in the browser for the current session; server-side document storage is not implemented.

## Try the API

- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/api-docs`
- H2 database console: `http://localhost:8080/h2-console` (JDBC URL `jdbc:h2:file:./data/contractwatch`, user `sa`, blank password)
- Postman: import `postman/ContractWatch.postman_collection.json`, then run **Create contract**. It saves the returned ID for later requests.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard/summary` | Dashboard counters and contract value |
| GET | `/api/contracts?q=cloud&status=ACTIVE&attention=critical` | Search and filter contracts |
| GET | `/api/contracts/{id}` | Contract detail |
| POST | `/api/contracts` | Create a contract; returns `201 Created` |
| PUT | `/api/contracts/{id}` | Replace contract fields |
| PATCH | `/api/contracts/{id}/status` | Change status (`ACTIVE`, `PENDING`, `RENEWED`, `TERMINATED`, `EXPIRED`, `CANCELLED`) |
| POST | `/api/contracts/{id}/renew` | Extend end date, optionally update amount and discount |
| GET | `/api/contracts/{id}/renewals` | Read-only renewal history for a contract |
| DELETE | `/api/contracts/{id}` | Delete a contract |
| GET | `/api/discounts` | Contracts with discount details |

Dates use ISO format (`YYYY-MM-DD`). Contract create/update requests require `contractName`, `vendor`, `amount`, `startDate`, and `endDate`.

## Use MySQL instead

Activate the `mysql` profile and configure environment variables:

```powershell
$env:SPRING_PROFILES_ACTIVE='mysql'
$env:MYSQL_URL='jdbc:mysql://localhost:3306/contractwatch?createDatabaseIfNotExist=true'
$env:MYSQL_USER='root'
$env:MYSQL_PASSWORD='your-password'
mvn spring-boot:run
```

The project includes the MySQL connector; the default local setup does not require a MySQL server.
