import re

with open('components/marketing/UpgradeModal.tsx', 'r') as f:
    content = f.read()

old_handle = """  const handleUpgrade = async (planName: string, priceId: string) => {
    setLoadingPlan(planName);
    try {
      console.log(`Initiating checkout per ${planName} con priceId: ${priceId}`);
      setTimeout(() => setLoadingPlan(null), 2000);
    } catch (error) {
      console.error(error);
      setLoadingPlan(null);
    }
  };"""

new_handle = """  const handleUpgrade = async (planName: string, priceId: string) => {
    setLoadingPlan(planName);
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user?.uid,
          userEmail: user?.email,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la creazione del checkout');
      }

      // Reindirizza l'utente alla pagina sicura di Stripe
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Stripe error:", error);
      alert("Errore nell'inizializzazione del pagamento. Riprova.");
      setLoadingPlan(null);
    }
  };"""

content = content.replace(old_handle, new_handle)

# Replace 'price_scale' and 'price_pro' with the real IDs
content = content.replace("'price_pro'", "'price_1UKwHW4MUA9fNfqqh4p1RJcS'")
content = content.replace("'price_scale'", "'price_1UKwKR4MUA9fNfqqdFw8uxTi'")

with open('components/marketing/UpgradeModal.tsx', 'w') as f:
    f.write(content)

print("Modal Stripe integration completed")
