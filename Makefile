.PHONY: prebuild clean-prebuild android virtual-smartphone ios apk logs test test-watch test-coverage test-ci clean-test help

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
	@echo "🔍 Verificando dispositivi collegati..."
	@adb devices
	@echo "🚀 Avvio su dispositivo fisico..."
	@echo "⚠️  Se non vedi il tuo smartphone nella lista sopra, abilita il debug USB!"
	export JAVA_HOME=/opt/homebrew/opt/openjdk@17 && \
	export ANDROID_HOME=$$HOME/Library/Android/sdk && \
	export PATH=$$PATH:$$ANDROID_HOME/platform-tools:$$ANDROID_HOME/cmdline-tools/latest/bin && \
	npx expo run:android --device
	@echo "✅ App avviata su dispositivo Android!"

# Avvia l'app su emulatore Android
virtual-smartphone:
	@echo "🤖 Avvio app su emulatore Android..."
	@echo "☕ Configurazione Java 17 e Android SDK..."
	@echo "🔍 Verificando emulatori disponibili..."
	@adb devices
	@echo "🚀 Avvio su emulatore..."
	export JAVA_HOME=/opt/homebrew/opt/openjdk@17 && \
	export ANDROID_HOME=$$HOME/Library/Android/sdk && \
	export PATH=$$PATH:$$ANDROID_HOME/platform-tools:$$ANDROID_HOME/cmdline-tools/latest/bin && \
	npx expo run:android
	@echo "✅ App avviata su emulatore Android!"

# Avvia l'app su iOS
ios:
	@echo "🍎 Avvio app su iOS..."
	npx expo run:ios
	@echo "✅ App avviata su iOS!"

# Genera APK per Android
apk:
	@echo "📦 Generazione APK Android..."
	@echo "☕ Configurazione Java 17 e Android SDK..."
	@if [ ! -d "android" ]; then \
		echo "🔧 Esecuzione prebuild (cartelle native non trovate)..."; \
		npx expo prebuild --platform android; \
	else \
		echo "✅ Cartelle native esistenti, salto il prebuild per preservare le icone personalizzate"; \
	fi
	@echo "🏗️  Build APK in corso..."
	export JAVA_HOME=/opt/homebrew/opt/openjdk@17 && \
	export ANDROID_HOME=$$HOME/Library/Android/sdk && \
	export PATH=$$PATH:$$ANDROID_HOME/platform-tools:$$ANDROID_HOME/cmdline-tools/latest/bin && \
	cd android && ./gradlew assembleRelease
	@echo "📝 Lettura versione da package.json..."
	@VERSION=$$(node -p "require('./package.json').version") && \
	APK_NAME="become-monitor-v$$VERSION.apk" && \
	APK_SOURCE="android/app/build/outputs/apk/release/app-release.apk" && \
	APK_DEST="android/app/build/outputs/apk/release/$$APK_NAME" && \
	echo "🔄 Rinominazione APK in $$APK_NAME..." && \
	mv "$$APK_SOURCE" "$$APK_DEST" && \
	echo "✅ APK generato e rinominato!" && \
	echo "📱 File APK: $$APK_DEST"

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
	@echo "  make apk             - Genera APK Android per distribuzione"
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

