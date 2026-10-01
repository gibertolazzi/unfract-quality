import re

with open('components/marketing/UpgradeModal.tsx', 'r') as f:
    content = f.read()

old_catch = """    } catch (error) {
      console.error("Stripe error:", error);
      alert("Errore nell'inizializzazione del pagamento. Riprova.");
      setLoadingPlan(null);
    }"""

new_catch = """    } catch (error: any) {
      console.error("Stripe error:", error);
      alert("Errore dal server: " + (error.message || "Errore sconosciuto"));
      setLoadingPlan(null);
    }"""

content = content.replace(old_catch, new_catch)

with open('components/marketing/UpgradeModal.tsx', 'w') as f:
    f.write(content)

print("Modal error handling patched")
