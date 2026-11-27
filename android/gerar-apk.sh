#!/usr/bin/env bash
# Gera o cifras-alerta.apk sem Gradle nem Android Studio: só o Android SDK e um JDK.
#
#   bash android/gerar-apk.sh
#
# Precisa de:
#   - Android SDK com build-tools e uma plataforma (padrão: %LOCALAPPDATA%\Android\Sdk)
#   - JDK 17 (padrão: ~/.cifras-ferramentas/jdk17/<pasta do jdk>)
# Para usar outros caminhos: ANDROID_SDK=... JDK=... bash android/gerar-apk.sh
#
# A chave de assinatura fica em android/assinatura/ (fora do git). GUARDE essa pasta:
# sem a mesma chave o celular não aceita uma versão nova por cima da antiga.

set -euo pipefail

VERSAO="1.0"   # aparece nas informações do app
CODIGO=1       # aumente em 1 a cada APK novo que for distribuir

AQUI="$(cd "$(dirname "$0")" && pwd)"
caminho() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else echo "$1"; fi; }

SDK="$(caminho "${ANDROID_SDK:-${LOCALAPPDATA:-$HOME/AppData/Local}/Android/Sdk}")"
JDK="$(caminho "${JDK:-$(ls -d "$HOME"/.cifras-ferramentas/jdk17/*/ 2>/dev/null | head -1)}")"
JDK="${JDK%/}"
FERRAMENTAS="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
PLATAFORMA="$SDK/platforms/android-34/android.jar"

for item in "$JDK/bin/javac" "$FERRAMENTAS/aapt2" "$FERRAMENTAS/lib/d8.jar" "$PLATAFORMA"; do
  ls "$item"* >/dev/null 2>&1 || { echo "Não achei: $item"; exit 1; }
done

cd "$AQUI"
rm -rf build
mkdir -p build/gen build/classes assinatura

echo "1/5 recursos (ícones, textos)"
"$FERRAMENTAS/aapt2" compile --dir res -o build/recursos.zip
"$FERRAMENTAS/aapt2" link -o build/base.apk -I "$PLATAFORMA" --manifest AndroidManifest.xml --java build/gen \
  --min-sdk-version 23 --target-sdk-version 34 --version-code "$CODIGO" --version-name "$VERSAO" build/recursos.zip

echo "2/5 código"
"$JDK/bin/javac" -source 8 -target 8 -bootclasspath "$PLATAFORMA" -Xlint:-options -encoding UTF-8 \
  -d build/classes $(find src build/gen -name '*.java')
"$JDK/bin/java" -cp "$FERRAMENTAS/lib/d8.jar" com.android.tools.r8.D8 --lib "$PLATAFORMA" --min-api 23 --release \
  --output build $(find build/classes -name '*.class')

echo "3/5 pacote"
cp build/base.apk build/app.apk
(cd build && "$JDK/bin/jar" uf app.apk classes.dex)
"$FERRAMENTAS/zipalign" -f -p 4 build/app.apk build/alinhado.apk

echo "4/5 assinatura"
if [ ! -f assinatura/cifras-alerta.jks ]; then
  head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32 > assinatura/senha.txt
  "$JDK/bin/keytool" -genkeypair -keystore assinatura/cifras-alerta.jks -alias cifras -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass:file assinatura/senha.txt -keypass:file assinatura/senha.txt \
    -dname "CN=Cifras Alerta, O=Alerta" >/dev/null 2>&1
  echo "    chave nova criada em android/assinatura/ (guarde essa pasta)"
fi
"$JDK/bin/java" -jar "$FERRAMENTAS/lib/apksigner.jar" sign --ks assinatura/cifras-alerta.jks --ks-key-alias cifras \
  --ks-pass file:assinatura/senha.txt --out ../cifras-alerta.apk build/alinhado.apk
rm -f ../cifras-alerta.apk.idsig

echo "5/5 conferência"
"$JDK/bin/java" -jar "$FERRAMENTAS/lib/apksigner.jar" verify --print-certs ../cifras-alerta.apk | head -2
ls -la ../cifras-alerta.apk
echo "Pronto: cifras-alerta.apk"
