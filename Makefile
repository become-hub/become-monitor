.PHONY: prebuild clean-prebuild android ios logs help

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

# Avvia l'app su Android
android:
	@echo "🤖 Avvio app su Android..."
	@echo "☕ Configurazione Java 17 e Android SDK..."
	export JAVA_HOME=/opt/homebrew/opt/openjdk@17 && \
	export ANDROID_HOME=$$HOME/Library/Android/sdk && \
	export PATH=$$PATH:$$ANDROID_HOME/platform-tools:$$ANDROID_HOME/cmdline-tools/latest/bin && \
	npx expo run:android
	@echo "✅ App avviata su Android!"

# Avvia l'app su iOS
ios:
	@echo "🍎 Avvio app su iOS..."
	npx expo run:ios
	@echo "✅ App avviata su iOS!"

# Mostra i log Android in tempo reale
logs:
	@echo "📋 Mostrando log Android (Ctrl+C per uscire)..."
	@adb logcat -s ReactNativeJS:V

# Mostra l'help
help:
	@echo "📋 Comandi disponibili:"
	@echo "  make prebuild        - Esegue npx expo prebuild --clean"
	@echo "  make clean-prebuild  - Rimuove le cartelle android/ e ios/"
	@echo "  make android         - Avvia l'app su Android (con Java 17)"
	@echo "  make ios             - Avvia l'app su iOS (expo run:ios)"
	@echo "  make logs            - Mostra i log Android in tempo reale"
	@echo "  make help            - Mostra questo messaggio"

