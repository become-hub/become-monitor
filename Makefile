.PHONY: prebuild clean-prebuild android virtual-smartphone ios apk aab create-file changeset changelog release logs test test-watch test-coverage test-ci clean-test help

# nvm non è disponibile nelle recipe Make (shell non-login): sourciare e usare l’alias default
# così Gradle trova `node` (errore tipico: Cannot run program "node").
define WITH_NVM_DEFAULT
. "$$HOME/.nvm/nvm.sh" && nvm use default
endef

define ENSURE_ANDROID_RELEASE_SIGNING
	@if [ ! -f "android/keystore.properties" ]; then \
		echo "❌ Manca android/keystore.properties (firma release per Play Console)."; \
		echo "   cp android/keystore.properties.example android/keystore.properties"; \
		echo "   Vedi docs/android-play-release.md"; \
		exit 1; \
	fi
endef

define ENSURE_PENDING_CHANGESETS
	@pending=$$(find .changeset -maxdepth 1 -type f -name '*.md' ! -name 'README.md' | wc -l | tr -d ' '); \
	if [ "$$pending" -eq 0 ]; then \
		echo "❌ Nessun changeset pendente in .changeset/."; \
		echo "   Aggiungine uno con: make changeset"; \
		echo "   Vedi docs/changesets-workflow.md"; \
		exit 1; \
	fi
endef

define ANDROID_RELEASE_ENV
$(WITH_NVM_DEFAULT) && \
	export JAVA_HOME=/opt/homebrew/opt/openjdk@17 && \
	export ANDROID_HOME=$$HOME/Library/Android/sdk && \
	export PATH="$$PATH:$$ANDROID_HOME/platform-tools:$$ANDROID_HOME/cmdline-tools/latest/bin"
endef

# Prebuild dell'app con clean per rigenerare completamente le cartelle native
prebuild:
	@echo "🔧 Esecuzione prebuild con clean..."
	npx expo prebuild --clean
	@echo "✅ Prebuild completato!"

# Pulisce le cartelle native generate
clean-prebuild:
	@echo "🧹 Rimozione cartelle native..."
	rm -rf android ios
	@echo "✅ Cartelle native rimosse!"

# Avvia l'app su dispositivo Android fisico
android:
	@echo "📱 Avvio app su dispositivo Android fisico..."
	@echo "☕ Configurazione Java 17 e Android SDK..."
	@echo "🧹 Reset ADB e rimozione target non-USB (Expo fallisce su emulator zombie)..."
	@adb kill-server >/dev/null 2>&1 || true
	@adb start-server >/dev/null
	@sleep 1
	@adb devices | awk 'NR>1 && $$2=="device" && ($$1 ~ /^emulator-/ || $$1 ~ /:/) { print $$1 }' | while read -r serial; do \
		adb disconnect "$$serial" >/dev/null 2>&1 || true; \
	done
	@echo "🔍 Verificando dispositivi collegati..."
	@adb devices -l
	@echo "🚀 Avvio su dispositivo fisico..."
	@echo "⚠️  Se non vedi il tuo smartphone nella lista sopra, abilita il debug USB!"
	@$(WITH_NVM_DEFAULT) && \
	export JAVA_HOME=/opt/homebrew/opt/openjdk@17 && \
	export ANDROID_HOME=$$HOME/Library/Android/sdk && \
	export PATH="$$PATH:$$ANDROID_HOME/platform-tools:$$ANDROID_HOME/cmdline-tools/latest/bin" && \
	DEVICE_SERIAL=$$(adb devices | awk 'NR>1 && $$2=="device" && $$1 !~ /^emulator-/ && $$1 !~ /:/ { print $$1; exit }') && \
	if [ -z "$$DEVICE_SERIAL" ]; then \
		echo "❌ Nessun dispositivo USB fisico trovato. Collega il telefono e abilita debug USB."; \
		exit 1; \
	fi && \
	DEVICE_NAME=$$(adb -s "$$DEVICE_SERIAL" shell getprop ro.product.model | tr -d '\r') && \
	if [ -z "$$DEVICE_NAME" ]; then DEVICE_NAME="$$DEVICE_SERIAL"; fi && \
	echo "📲 Device selezionato: $$DEVICE_SERIAL ($$DEVICE_NAME)" && \
	adb devices | awk 'NR>1 && $$2=="device" && ($$1 ~ /^emulator-/ || $$1 ~ /:/) { print $$1 }' | while read -r serial; do \
		adb disconnect "$$serial" >/dev/null 2>&1 || true; \
	done && \
	cd android && ./gradlew --stop >/dev/null 2>&1 || true && \
	cd .. && \
	adb devices | awk 'NR>1 && $$2=="device" && ($$1 ~ /^emulator-/ || $$1 ~ /:/) { print $$1 }' | while read -r serial; do \
		adb disconnect "$$serial" >/dev/null 2>&1 || true; \
	done && \
	export ANDROID_SERIAL="$$DEVICE_SERIAL" && \
	npx expo run:android --device "$$DEVICE_NAME"
	@echo "✅ App avviata su dispositivo Android!"

# Avvia l'app su emulatore Android
virtual-smartphone:
	@echo "🤖 Avvio app su emulatore Android..."
	@echo "☕ Configurazione Java 17 e Android SDK..."
	@echo "🔍 Verificando emulatori disponibili..."
	@adb devices
	@echo "🚀 Avvio su emulatore..."
	@$(WITH_NVM_DEFAULT) && \
	export JAVA_HOME=/opt/homebrew/opt/openjdk@17 && \
	export ANDROID_HOME=$$HOME/Library/Android/sdk && \
	export PATH="$$PATH:$$ANDROID_HOME/platform-tools:$$ANDROID_HOME/cmdline-tools/latest/bin" && \
	cd android && ./gradlew --stop >/dev/null 2>&1 || true && \
	cd .. && \
	npx expo run:android
	@echo "✅ App avviata su emulatore Android!"

# Avvia l'app su iOS
ios:
	@echo "🍎 Avvio app su iOS..."
	npx expo run:ios
	@echo "✅ App avviata su iOS!"

# Genera APK firmato per Android (release / sideload)
apk:
	@echo "📦 Generazione APK Android (release)..."
	@echo "☕ Configurazione Java 17 e Android SDK..."
	$(ENSURE_ANDROID_RELEASE_SIGNING)
	@if [ ! -d "android" ]; then \
		echo "🔧 Esecuzione prebuild (cartelle native non trovate)..."; \
		npx expo prebuild --platform android; \
	else \
		echo "✅ Cartelle native esistenti, salto il prebuild per preservare le icone personalizzate"; \
	fi
	@echo "🏗️  Build APK in corso..."
	@$(ANDROID_RELEASE_ENV) && \
	cd android && ./gradlew --stop >/dev/null 2>&1 || true && \
	./gradlew assembleRelease
	@echo "📝 Lettura versione da package.json..."
	@VERSION=$$(node -p "require('./package.json').version") && \
	APK_NAME="become-monitor-v$$VERSION.apk" && \
	APK_SOURCE="android/app/build/outputs/apk/release/app-release.apk" && \
	APK_DEST="android/app/build/outputs/apk/release/$$APK_NAME" && \
	echo "🔄 Rinominazione APK in $$APK_NAME..." && \
	mv "$$APK_SOURCE" "$$APK_DEST" && \
	echo "✅ APK generato e rinominato!" && \
	echo "📱 File APK: $$APK_DEST"

# Genera AAB firmato per Google Play Console
aab:
	@echo "📦 Generazione AAB Android (Play Console)..."
	@echo "☕ Configurazione Java 17 e Android SDK..."
	$(ENSURE_ANDROID_RELEASE_SIGNING)
	@if [ ! -d "android" ]; then \
		echo "🔧 Esecuzione prebuild (cartelle native non trovate)..."; \
		npx expo prebuild --platform android; \
	else \
		echo "✅ Cartelle native esistenti, salto il prebuild per preservare le icone personalizzate"; \
	fi
	@echo "🏗️  Build AAB in corso..."
	@$(ANDROID_RELEASE_ENV) && \
	cd android && ./gradlew --stop >/dev/null 2>&1 || true && \
	./gradlew bundleRelease
	@echo "📝 Lettura versione da package.json..."
	@VERSION=$$(node -p "require('./package.json').version") && \
	AAB_NAME="become-monitor-v$$VERSION.aab" && \
	AAB_SOURCE="android/app/build/outputs/bundle/release/app-release.aab" && \
	AAB_DEST="android/app/build/outputs/bundle/release/$$AAB_NAME" && \
	echo "🔄 Rinominazione AAB in $$AAB_NAME..." && \
	mv "$$AAB_SOURCE" "$$AAB_DEST" && \
	echo "✅ AAB generato e rinominato!" && \
	echo "📱 File AAB: $$AAB_DEST"

# APK + AAB firmati (versione corrente in package.json)
create-file: aab apk
	@echo "✅ Artefatti pronti (AAB + APK)."

# Changesets: aggiungi intent di release per il branch corrente
changeset:
	@echo "📝 Creazione changeset (npx changeset add)..."
	@npx changeset add

# Consolida .changeset/*.md → CHANGELOG.md + bump package.json;
# Expo legge la version da package.json (app.config.js); lock via npm; iOS via agvtool.
changelog:
	@echo "📒 Changelog finale da Changesets..."
	$(ENSURE_PENDING_CHANGESETS)
	@npx changeset version
	@npm install --package-lock-only
	@VERSION=$$(node -p "require('./package.json').version") && \
	echo "🍎 iOS MARKETING_VERSION → $$VERSION" && \
	cd ios && xcrun agvtool new-marketing-version "$$VERSION" && \
	xcrun agvtool next-version -all
	@echo "✅ CHANGELOG e versioni aggiornati."

# Changelog + AAB/APK (pipeline release Android)
release: changelog create-file
	@echo "✅ Release completa (changelog + AAB/APK)."

# Mostra i log Android in tempo reale
logs:
	@echo "📋 Mostrando log Android (Ctrl+C per uscire)..."
	@adb logcat -s ReactNativeJS:V

# Esegue i test
test:
	@echo "🧪 Eseguendo test..."
	@npm test

# Esegue i test in modalità watch
test-watch:
	@echo "👀 Eseguendo test in watch mode..."
	@npm run test:watch

# Esegue i test con coverage
test-coverage:
	@echo "📊 Eseguendo test con coverage..."
	@npm run test:coverage

# Esegue i test in modalità CI (no watch, con coverage)
test-ci:
	@echo "🤖 Eseguendo test in modalità CI..."
	@npm run test:coverage -- --ci --maxWorkers=2

# Pulisce la cache di Jest
clean-test:
	@echo "🧹 Pulizia cache Jest..."
	@npx jest --clearCache
	@echo "✅ Cache Jest pulita!"

# Mostra l'help
help:
	@echo "📋 Comandi disponibili:"
	@echo ""
	@echo "Build & Run:"
	@echo "  make prebuild        - Esegue npx expo prebuild --clean"
	@echo "  make clean-prebuild  - Rimuove le cartelle android/ e ios/"
	@echo "  make android         - Avvia l'app su dispositivo Android fisico"
	@echo "  make virtual-smartphone - Avvia l'app su emulatore Android"
	@echo "  make ios             - Avvia l'app su iOS (expo run:ios)"
	@echo "  make apk             - Genera APK Android firmato (release)"
	@echo "  make aab             - Genera AAB Android per Play Console"
	@echo "  make create-file     - Genera AAB + APK firmati"
	@echo ""
	@echo "Versioning (Changesets):"
	@echo "  make changeset       - npx changeset add (bump + summary branch)"
	@echo "  make changelog       - changeset version + npm lock + agvtool iOS"
	@echo "  make release         - changelog + create-file (AAB/APK)"
	@echo ""
	@echo "Testing:"
	@echo "  make test            - Esegue i test"
	@echo "  make test-watch      - Esegue i test in watch mode"
	@echo "  make test-coverage   - Esegue i test con coverage report"
	@echo "  make test-ci         - Esegue i test in modalità CI"
	@echo "  make clean-test      - Pulisce la cache di Jest"
	@echo ""
	@echo "Debug:"
	@echo "  make logs            - Mostra i log Android in tempo reale"
	@echo ""
	@echo "  make help            - Mostra questo messaggio"

