# Guía paso a paso: cuenta AWS, usuarios y despliegue

Esta guía cubre lo que el equipo hace a mano en la consola de AWS. Todo lo demás (Cognito, API, Lambdas, DynamoDB, S3 y CloudFront) lo crea `sam deploy`.

## Paso 1. Crear la cuenta Free plan (una por equipo)

1. Entrar a https://aws.amazon.com/es/free/ → **Crear una cuenta gratuita**.
2. Usar un correo del equipo y un nombre de cuenta como `aqp-solidaria-equipoX`.
3. Elegir **Free plan**, no Paid plan. El Free plan no cobra: el consumo sale de los créditos (hasta 200 USD por 6 meses) y la cuenta se cierra antes de cobrar.
4. Completar teléfono y, si lo pide, tarjeta (solo verificación). Plan de soporte: **Básico (gratuito)**.

> **Importante:** la cuenta se creó con la **nueva experiencia de AWS** (consola con "Proyectos", "Equipo" y AWS Builder ID). En esta modalidad **no existe usuario root**, la región la asigna AWS según el país (Perú → **us-east-2, Ohio**) y los usuarios IAM solo pueden tener acceso programático. Por eso los pasos 2 a 5 difieren de la guía clásica. **No** se activan las "características avanzadas", para mantener el Free plan. Fuente: [Compare sign-up options](https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html).

## Paso 2. MFA en el AWS Builder ID del dueño

1. Ir a https://settings.aws.com → menú **Manage security and sign-in** (Administrar seguridad e inicio de sesión). Redirige al perfil del AWS Builder ID.
   - Si la cuenta se creó con **Continuar con Google**, el MFA se activa en la cuenta de Google (verificación en dos pasos).
2. En **Security**, elegir **Register device** → **Authenticator app**.
3. Escanear el QR con Google Authenticator o Microsoft Authenticator y escribir el código → **Assign MFA**.
4. Registrar un segundo dispositivo de respaldo (recomendado por AWS: si se pierden todos, la cuenta no se recupera).

## Paso 3. Región

No se elige: la del proyecto es **us-east-2 (Ohio)**. Se confirma en settings.aws.com → **Project** → *Additional info* → **Region**. La plantilla SAM y los scripts ya usan us-east-2.

## Paso 4. Alerta de presupuesto (CA-NF09.1)

1. Buscar **Budgets** en la consola → **Crear presupuesto** → plantilla **Presupuesto de gasto cero**.
2. Poner los correos del equipo → **Crear**.
3. Tomar captura para `evidence/`.

## Paso 5. Integrantes del equipo (CA-NF03.3)

1. En el menú de la cuenta (arriba a la derecha) → **Equipo** → invitar a cada integrante con su correo.
2. Cada integrante acepta la invitación con **su propio AWS Builder ID** y le activa MFA (Paso 2).
3. No se crean usuarios IAM de consola ni llaves de acceso.
4. Captura de la lista del equipo → `evidence/`.

## Paso 6. Desplegar desde AWS CloudShell (sin instalar nada)

Lo ejecuta el dueño o un integrante del equipo, en la región del proyecto (us-east-2):

1. Abrir **CloudShell** (ícono `>_` en la barra superior o abajo a la izquierda). Usa credenciales temporales: no hay llaves que guardar. Verificar con `echo $AWS_REGION` que diga `us-east-2`.
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
