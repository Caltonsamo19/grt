const fs = require('fs');

console.log('🧹 Limpando duplicados e corrigindo erros...\n');

// Ler arquivo
const data = JSON.parse(fs.readFileSync('competitors.json', 'utf-8'));

console.log(`📊 Total original: ${data.length} números`);

// Remover duplicados e números inválidos
const numerosValidos = new Set();
let duplicados = 0;
let invalidos = 0;

data.forEach((num, index) => {
  // Verificar se é válido
  if (typeof num !== 'string') {
    console.log(`❌ Removido (não é string) na linha ${index + 2}:`, num);
    invalidos++;
    return;
  }

  // Verificar formato (258 + 9 dígitos)
  if (!/^258\d{9}$/.test(num)) {
    console.log(`❌ Removido (formato inválido) na linha ${index + 2}:`, num);
    invalidos++;
    return;
  }

  // Verificar duplicado
  if (numerosValidos.has(num)) {
    duplicados++;
  } else {
    numerosValidos.add(num);
  }
});

// Converter para array e ordenar
const listaLimpa = [...numerosValidos].sort();

// Salvar
fs.writeFileSync('competitors.json', JSON.stringify(listaLimpa, null, 2), 'utf-8');

console.log(`\n✅ Limpeza concluída!`);
console.log(`❌ Duplicados removidos: ${duplicados}`);
console.log(`❌ Inválidos removidos: ${invalidos}`);
console.log(`📈 Total final: ${listaLimpa.length} números únicos`);
console.log(`✅ Arquivo salvo: competitors.json`);
