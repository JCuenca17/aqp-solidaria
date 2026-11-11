# Guía paso a paso: cuenta AWS, usuarios y despliegue

Esta guía cubre lo que el equipo hace a mano en la consola de AWS. Todo lo demás (Cognito, API, Lambdas, DynamoDB, S3 y CloudFront) lo crea `sam deploy`.

## Paso 1. Crear la cuenta Free plan (una por equipo)

1. Entrar a https://aws.amazon.com/es/free/ → **Crear una cuenta gratuita**.
2. Usar un correo del equipo y un nombre de cuenta como `aqp-solidaria-equipoX`.
3. Elegir **Free plan**, no Paid plan. El Free plan no cobra: el consumo sale de los créditos (hasta 200 USD por 6 meses) y la cuenta se cierra antes de cobrar.
4. Completar teléfono y, si lo pide, tarjeta (solo verificación). Plan de soporte: **Básico (gratuito)**.

## Paso 2. Proteger el usuario root (y dejar de usarlo)

1. Iniciar sesión como root → menú de la cuenta (arriba a la derecha) → **Credenciales de seguridad**.
2. **Asignar dispositivo MFA** → *Aplicación de autenticación* → escanear el QR con Google Authenticator o Microsoft Authenticator → ingresar dos códigos seguidos.
3. No crear llaves de acceso para root. A partir del paso 3, root no se vuelve a usar (CA-NF03.3).

## Paso 3. Región única

Arriba a la derecha, seleccionar **EE. UU. Este (Norte de Virginia) us-east-1**. Todo el proyecto vive en esa región.

## Paso 4. Alerta de presupuesto (CA-NF09.1)

1. Buscar **Budgets** → **Crear presupuesto** → plantilla **Presupuesto de gasto cero** (alerta en cuanto haya cualquier gasto).
2. Poner los correos del equipo → **Crear**.
3. Tomar captura para `evidence/` (evidencia de RNF-HU-09).

## Paso 5. Un usuario IAM por integrante, con MFA y sin llaves

1. Buscar **IAM** → **Grupos de usuarios** → crear dos grupos:
   - `Despliegue`: política `AdministratorAccess`. Solo para 1–2 personas (líder técnico e identidad). Se justifica porque `sam deploy` crea roles IAM y el Free plan no tiene IAM Identity Center.
   - `Equipo`: políticas `ReadOnlyAccess` y `AWSCloudShellFullAccess`, para revisar logs, CloudWatch y evidencias.
2. **Usuarios** → **Crear usuario** (uno por integrante):
   - Marcar **Proporcionar acceso a la consola** y la opción de cambiar la contraseña en el primer inicio.
   - Asignarlo a su grupo.
   - **No crear llaves de acceso** (access keys).
3. Cada integrante entra con la URL de inicio de sesión de la cuenta (aparece en el panel de IAM), cambia su contraseña y en **Credenciales de seguridad** asigna su **MFA**.
4. Captura de la lista de usuarios con la columna MFA → `evidence/`.

## Paso 6. Desplegar desde AWS CloudShell (sin instalar nada)

Lo ejecuta un integrante del grupo `Despliegue`, con su usuario IAM y en us-east-1:

1. Abrir **CloudShell** (ícono `>_` en la barra superior). Usa credenciales temporales: no hay llaves que guardar.
2. Verificar las herramientas:
   ```bash
   node -v      # se necesita 20.19 o superior
   sam --version
   ```
   Si Node es antiguo: `sudo npm install -g n && sudo n 22 && hash -r`.
3. Clonar y desplegar:
   ```bash
   git clone https://github.com/JCuenca17/aqp-solidaria.git
   cd aqp-solidaria
   bash scripts/deploy.sh
   ```
   Tarda unos 5–10 minutos (CloudFront es lo más lento). Al final muestra **WebUrl** (la demo HTTPS) y **ApiUrl**.

## Paso 7. Usuarios de prueba y MFA de roles privilegiados

```bash
bash scripts/create-users.sh                         # donante1, donante2, gestor y auditor (@example.com)
bash scripts/enroll-totp.sh gestor@example.com GESTOR
bash scripts/enroll-totp.sh auditor@example.com AUDITOR
```

`enroll-totp.sh` muestra una clave: se agrega en la app autenticadora (*Ingresar clave de configuración*) y se escribe el código de 6 dígitos. Desde ese momento, gestor y auditor no pueden entrar sin ese código (HU-11).

## Paso 8. Datos y pruebas

Ver la sección **Pruebas** del README: crear y publicar proyectos (o `seed-projects.mjs` para 50), ejecutar `security-tests.mjs`, `t10-iam-check.sh`, `t13-revocation.mjs`, `t14-mfa-check.sh` y `perf-test.mjs`.

## Paso 9. Limpieza al terminar la evaluación (CA-NF09.2)

```bash
bash scripts/cleanup.sh
```

Después revisar en **Resource Explorer** o el **Tag Editor** (etiqueta `Project=aqp-solidaria`) que no quede nada, y borrar el bucket `aws-sam-cli-managed-default-*` si ya no se usará.
