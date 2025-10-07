.PHONY: prebuild clean-prebuild help

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

# Mostra l'help
help:
	@echo "📋 Comandi disponibili:"
	@echo "  make prebuild        - Esegue npx expo prebuild --clean"
	@echo "  make clean-prebuild  - Rimuove le cartelle android/ e ios/"
	@echo "  make help            - Mostra questo messaggio"

