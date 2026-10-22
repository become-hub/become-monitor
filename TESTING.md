# Testing Guide

## 🧪 Come eseguire i test

### Test completi
```bash
make test
# oppure
npm test
```

### Test in modalità watch (sviluppo)
```bash
make test-watch
# oppure
npm run test:watch
```

### Test con coverage
```bash
make test-coverage
# oppure
npm run test:coverage
```

## 📊 Coverage

I test coprono:
- **HRV Calculator** (`features/hrv/core/hrv-calculator.ts`)
  - Calcolo RMSSD
  - Calcolo LF/HF
  - Gestione edge cases

- **Auth Service** (`services/auth-service.ts`)
  - Flusso di autenticazione dispositivo
  - Polling stato autenticazione
  - Gestione errori di rete

- **Ably Service** (`services/ably-service.ts`)
  - Connessione Ably
  - Invio dati HR
  - Gestione presenza
  - Stati di connessione

## 🔧 Struttura Test

```
services/
├── __tests__/
│   ├── hrv-calculator.test.ts
│   ├── auth-service.test.ts
│   └── ably-service.test.ts
├── hrv-calculator.ts
├── auth-service.ts
└── ably-service.ts
```

## ✅ Cosa viene testato

### HRV Calculator
- ✅ Calcoli matematici corretti (RMSSD, LF/HF)
- ✅ Filtro artefatti (diff > 200ms)
- ✅ Gestione finestre di dimensioni diverse
- ✅ Edge cases (valori vuoti, negativi, molto grandi)

### Auth Service
- ✅ Chiamate API corrette
- ✅ Gestione risposte OK/KO
- ✅ Parsing JSON
- ✅ Gestione errori di rete
- ✅ Flusso completo start → poll

### Ably Service
- ✅ Connessione con token
- ✅ Stati di connessione (connecting, connected, disconnected)
- ✅ Invio messaggi heartRate
- ✅ Gestione presenza
- ✅ Chiusura connessione

## 🐛 Debug Test

### Test fallito
```bash
# Vedi dettagli completi
npm test -- --verbose

# Esegui solo un file specifico
npm test hrv-calculator.test.ts
```

### Aggiornare snapshots
```bash
npm test -- -u
```

## 📝 Scrivere nuovi test

### Template test service
```typescript
import { MyService } from '../my-service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
    jest.clearAllMocks();
  });

  describe('myMethod', () => {
    it('fa quello che deve fare', () => {
      const result = service.myMethod(input);
      expect(result).toBe(expected);
    });

    it('gestisce errori', () => {
      expect(() => service.myMethod(badInput)).toThrow();
    });
  });
});
```

## 🎯 Best Practices

1. **Ogni test dovrebbe essere isolato** - usa `beforeEach` per reset
2. **Testa un comportamento per test** - no test con 10 assert
3. **Nomi descrittivi** - "calcola RMSSD correttamente" invece di "test1"
4. **Mock solo quello che serve** - non mock tutto se non necessario
5. **Test edge cases** - valori vuoti, null, negativi, molto grandi
6. **Coverage > 80%** - obiettivo minimo per codice critico

## 🚀 CI/CD

I test vengono eseguiti automaticamente su:
- Ogni commit
- Ogni pull request
- Prima del deploy

Se i test falliscono, il build viene bloccato.

