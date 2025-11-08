const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('competitors.json', 'utf-8'));
  console.log('✅ Sintaxe JSON válida!');
  console.log('📊 Total de números:', data.length);
  console.log('🔢 Únicos:', new Set(data).size);

  if(data.length !== new Set(data).size) {
    console.log('⚠️  Arquivo tem duplicados!');
  } else {
    console.log('✅ Sem duplicados!');
  }

  // Verificar formato dos números
  let erros = 0;
  data.forEach((num, index) => {
    if (typeof num !== 'string') {
      console.log(`❌ Linha ${index + 2}: não é string -`, num);
      erros++;
    } else if (!/^258\d{9}$/.test(num)) {
      console.log(`⚠️  Linha ${index + 2}: formato inválido -`, num);
      erros++;
    }
  });

  if (erros === 0) {
    console.log('✅ Todos os números estão no formato correto!');
  } else {
    console.log(`❌ Encontrados ${erros} erros de formato`);
  }

} catch(e) {
  console.log('❌ ERRO DE SINTAXE JSON:', e.message);
  console.log('   Posição:', e.stack);
}
