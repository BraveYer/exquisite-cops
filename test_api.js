const username = 'dom'; 

const apiUrl = `https://api-cops.criticalforce.fi/api/public/profile?usernames=${username}`;

async function testCopsAPI() {
    try {
        console.log(`Caut datele pentru jucătorul: ${username}...`);
        
        // Adăugăm "Headers" ca să părem un browser real, nu un bot de Node.js
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });
        
        // Afișăm codul de status (200 înseamnă OK, 403 înseamnă Interzis, 404 înseamnă Nu a fost găsit)
        console.log(`Statusul răspunsului: ${response.status}`);
        
        // Citim răspunsul brut, ca text, indiferent ce ne trimite serverul
        const rawText = await response.text();
        
        // Verificăm dacă răspunsul începe cu "{" sau "[" (adică e JSON valid)
        if (rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
            const data = JSON.parse(rawText);
            console.log("Răspunsul API-ului este:");
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log("Nu am primit JSON. Iată primele 300 de caractere din ce a trimis serverul:");
            console.log(rawText.substring(0, 300)); // Afișăm doar începutul paginii HTML ca să ne dăm seama de eroare
        }
        
    } catch (error) {
        console.error("A apărut o eroare la conexiune:", error);
    }
}

testCopsAPI();