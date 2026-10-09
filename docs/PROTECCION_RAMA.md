# Protección de la rama `main`

GitHub muestra el aviso *"Your main branch isn't protected"* porque cualquiera con permisos de escritura puede hacer *push* directo, reescribir el historial (`--force`) o borrar `main`. Esta configuración se hace en la web de GitHub (requiere ser administrador del repositorio).

## Opción recomendada: Ruleset

1. Abra **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
2. **Ruleset name:** `Proteger main`. **Enforcement status:** `Active`.
3. **Bypass list:** agregue `Repository admin` solo si necesita hacer correcciones urgentes sin PR. Para máxima protección, déjela vacía.
4. **Target branches → Add target → Include default branch**.
5. Active estas reglas:
   - ✅ **Restrict deletions**: impide borrar `main`.
   - ✅ **Block force pushes**: impide reescribir el historial.
   - ✅ **Require linear history** (opcional): historial limpio con *squash* o *rebase*.
   - ✅ **Require a pull request before merging**
     - *Required approvals*: `1` si hay más de una persona en el equipo. **Si usted es el único mantenedor, deje `0`**, porque GitHub no permite aprobar el PR propio y quedaría bloqueado.
     - ✅ *Dismiss stale pull request approvals when new commits are pushed*
     - ✅ *Require review from Code Owners* (si hay más de un mantenedor; ver `.github/CODEOWNERS`)
     - ✅ *Require conversation resolution before merging*
   - ✅ **Require status checks to pass**
     - ✅ *Require branches to be up to date before merging*
     - Agregue los checks (aparecen después de la primera ejecución del CI):
       - `Lint, tests y build`
       - `Imagen Docker`
6. **Create**.

## Ajustes complementarios

- **Settings → General → Pull Requests:** active *Allow squash merging* y *Automatically delete head branches*.
- **Settings → Code security:** active *Dependabot alerts*, *Dependabot security updates*, *Secret scanning*, *Push protection* y *Private vulnerability reporting*.
- **Settings → Actions → General → Workflow permissions:** *Read repository contents permission*.

## Flujo de trabajo resultante

```
rama de trabajo → Pull Request → CI en verde (+ revisión) → merge a main
```

Con la protección activa, `git push origin main` es rechazado. Los cambios entran solo mediante Pull Request.
