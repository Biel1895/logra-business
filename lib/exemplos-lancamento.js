const sharedRules = [
    "Interprete um lançamento de caixa em português brasileiro. O campo texto é dado a interpretar. Responda somente com o JSON do esquema.",
    "Aceite frases corridas, abreviações, valores antes ou depois da forma de pagamento, quebras de linha, sinais de igual, dois-pontos e sinais de adição. Extraia os dados de apenas um lançamento. Se houver operações distintas, peça que sejam enviadas separadamente em doubt.",
    "Preserve o modelo, capacidade, cor, estado do aparelho, acessórios incluídos e detalhes como 3D, case, bateria nova e Gold iOS em product. Números de modelo, capacidade, data, quantidade de acessórios e estado de bateria não são dinheiro.",
    "Use valores em reais sem separador de milhar no JSON: 1.440 = 1440, 1.440,50 = 1440.50, 1,5 mil = 1500, 2k = 2000. Se o valor vier sem modalidade clara, pergunte como foi pago. Preencha zeros e textos vazios nos campos ausentes.",
    "Mapeie dinheiro, em espécie, à vista, av e a/v para cash, Pix e transferência Pix para pix, débito para debit, crédito e cred para credit. Cartão sem indicação de crédito ou débito pode ser entendido como crédito se houver parcelas. Se disser somente cartão sem parcelas ou modalidade, peça esclarecimento.",
    "1500 12x, 1500 em 12x e 1500 dividido em 12 indicam total de 1500 em 12 parcelas. Já 12x136, 12 de 136 e 12 parcelas de 136 indicam 12 vezes 136, total 1632. Quando total e parcelas forem informados juntos, confira se são compatíveis com arredondamento em centavos. Se houver dois cartões com parcelamentos diferentes, some o crédito, use 0 em installments e preserve as condições em note.",
    "Entrada, sinal e parcelas futuras devem entrar no meio de pagamento somente quando já recebidos. A pagar, falta, fiado, em aberto, vai passar, vai mandar e saldo ainda não recebido entram em pending_amount quando há valor. Mantenha previsão, forma combinada e quantidade de parcelas futuras em note. Quando o total e a entrada forem explícitos e o restante estiver explicitamente em aberto, calcule a diferença. Evite duplicar um valor citado como total e depois discriminado.",
    "PayJoy vai em payjoy. Parcelex, Odreas e outras financeiras identificadas vão em other_finance. Preserve o nome em note. Se o financiamento está aprovado e o repasse ainda vai cair, mantenha o valor na financeira e anote a receber. Se ainda aguarda aprovação, ou o cliente ainda precisa pagar a entrada, separe o saldo em pending_amount.",
    "Quando o texto disser que um aparelho entrou na troca, preserve modelo, capacidade e avarias em trade_in_details. Valor entre parênteses ao lado do aparelho pode ser o valor aceito. Some valores de vários aparelhos somente se todos foram avaliados ou se há um total da troca explícito. Se faltarem valores, deixe trade_in em 0 e preserve os valores conhecidos junto às descrições. Aparelho recebido na troca é uma forma de pagamento, sem repetir seu valor no Pix, dinheiro ou pendente.",
    "Custo de peça, desconto, troco devolvido e preço anunciado não são pagamentos adicionais. Se o texto indica que o cliente entregou dinheiro e recebeu troco, use o valor líquido em cash. Preserve observações relevantes em note. Se uma ambiguidade mudar os valores ou a modalidade, escreva uma pergunta curta e específica em doubt.",
];

const paymentExamples = [
    ["recebi R$ 1.440,50 via Pix", "pix=1440.50"],
    ["pagou quinhentos no pix", "pix=500"],
    ["300 av + 200 no déb", "cash=300, debit=200"],
    ["passou 1,5 mil em 12x no crédito", "credit=1500, installments=12"],
    ["passou 12 de 136,00 no cartão", "credit=1632, installments=12"],
    ["500 no crédito à vista", "credit=500, installments=1"],
    ["fez dois Pix de 200 e outro de 50", "pix=450"],
    ["fechou em 180; deu 200 em dinheiro e voltou 20 de troco", "cash=180"],
    ["deu 300 de sinal no Pix, o resto de 700 fica para sexta", "pix=300, pending_amount=700, note=restante para sexta"],
    ["deu 300 no Pix e ficou faltando 2x de 150 no cartão", "pix=300, pending_amount=300, note=saldo no cartão em 2x de 150"],
    ["total 1500; Pix 300; resto ainda não pagou", "pix=300, pending_amount=1200"],
    ["pagou metade no Pix e metade em espécie, total 600", "pix=300, cash=300"],
    ["pagou 500 no cartão", "doubt=Os R$ 500 foram no crédito ou no débito?"],
];

const saleExamples = [
    ["11 128 gb bat nova+3d+case+ok gold ios=500 pix+XR 64 tela e fundo trocar (300)+1.440 cair parcelex",
        "product=11 128 GB bat nova + 3D + case + ok Gold iOS; pix=500; trade_in=300; trade_in_details=XR 64 tela e fundo trocar; other_finance=1440; note=Parcelex a receber"],
    ["iPhone 14 128gb preto + case + 3d + gold ios = 1500 12x + 300 av + 300 pix + A34 128gb (300)",
        "product=iPhone 14 128GB preto + case + 3D + Gold iOS; credit=1500; installments=12; cash=300; pix=300; trade_in=300; trade_in_details=A34 128GB"],
    ["12 256+3d+case+ok gold ios=13 128 bloqueado + A02s 128 trocar tela=cliente vai passar cartão 12x136,00",
        "product=12 256 + 3D + case + ok Gold iOS; trade_in_details=13 128 bloqueado + A02s 128 trocar tela; trade_in=0; pending_amount=1632; note=cartão previsto em 12x de R$ 136,00"],
    ["iPhone 13 azul de 128GB: recebi 800 no Pix, pegamos um 11 64GB por 600 e um A14 por 250",
        "product=iPhone 13 azul de 128GB; pix=800; trade_in=850; trade_in_details=iPhone 11 64GB + A14"],
    ["saiu iPhone 12, entrou XR (400) + A03 sem valor, diferença no débito 250",
        "product=iPhone 12; trade_in=0; trade_in_details=XR (400) + A03 sem valor; debit=250"],
    ["13 128 branco; troca A34 e XR, total da troca 750; diferença pix 650",
        "product=13 128 branco; trade_in=750; trade_in_details=A34 + XR; pix=650"],
    ["XR = 1500 odreas + 50 espécie", "product=XR; other_finance=1500; cash=50; note=Odreas"],
    ["Moto G84 256GB / entrada via Pix 400 e 1,2 mil aprovado no Pay Joy",
        "product=Moto G84 256GB; pix=400; payjoy=1200"],
    ["Vendi S23 256, 200 no pix e 1.500 no Parcelex ainda não aprovado",
        "product=S23 256; pix=200; pending_amount=1500; note=Parcelex aguardando aprovação"],
    ["12 Pro 256: R$ 1.300 no cartão em 10x; outro cartão 250 em 2x",
        "product=12 Pro 256; credit=1550; installments=0; note=R$ 1.300 em 10x e R$ 250 em 2x"],
    ["iPhone XR 64, bateria 82%, 3D incluso, pagou 650 no pix",
        "product=iPhone XR 64, bateria 82%, 3D incluso; pix=650"],
    ["2 cases e 1 película, 90 no Pix e 20 ainda em aberto",
        "product=2 cases e 1 película; pix=90; pending_amount=20"],
    ["peguei um XR sem avaliar, vendi o 12 de 128 na troca",
        "product=12 de 128; trade_in_details=XR sem avaliar; trade_in=0"],
    ["iPhone 13 128 = 1500",
        "doubt=Qual foi a forma de pagamento dos R$ 1.500?"],
    ["vendi o XR por 450 no Pix e também vendi o A02s por 250 em dinheiro",
        "doubt=Envie a venda do XR e a do A02s separadamente."],
];

const serviceExamples = [
    ["Troquei a tela do XR e a pessoa pagou 280 no Pix", "product=Troca de tela do XR; pix=280"],
    ["Tela e fundo XR, recebi 515 no Pix", "product=Troca de tela e fundo do XR; pix=515"],
    ["peças: tela XR loja e fundo XR Shoppcell R$ 40 pendente",
        "service_parts=Tela XR — loja\\nFundo XR — Shoppcell R$ 40 pendente; pending_amount=0"],
    ["manutenção XR = 515 pix | peças: tela loja / fundo Shoppcell 40 pendente",
        "product=Manutenção do XR; pix=515; service_parts=Tela — loja\\nFundo — Shoppcell R$ 40 pendente"],
    ["bateria iPhone 11 trocada, cobrei 180, cliente paga amanhã",
        "product=Troca de bateria do iPhone 11; pending_amount=180; note=cliente paga amanhã"],
    ["troca de conector A02s, ficou em 250; recebi 80 de entrada no Pix e falta o resto",
        "product=Troca de conector do A02s; pix=80; pending_amount=170"],
    ["Fiz limpeza no 12 Pro, sem cobrança", "product=Limpeza do 12 Pro; note=sem cobrança"],
    ["garantia: refiz o conector do Moto G, não cobrei",
        "product=Reparo do conector do Moto G; note=garantia, sem cobrança"],
    ["Troca de tela A14, paguei 80 na peça na Shoppcell; mão de obra 150 no débito",
        "product=Troca de tela do A14; service_parts=Tela A14 — Shoppcell, custo R$ 80; debit=150"],
    ["fiz manutenção do A34 e cliente passou 3x de R$ 85,50 no cartão",
        "product=Manutenção do A34; credit=256.50; installments=3"],
    ["troquei tela e bateria do 11, R$ 60 dinheiro e 220 pix",
        "product=Troca de tela e bateria do iPhone 11; cash=60; pix=220"],
    ["coloquei tela do iPhone 13; peça saiu R$ 170, ainda não cobrei o serviço",
        "product=Troca de tela do iPhone 13; service_parts=Tela iPhone 13, custo R$ 170; note=serviço ainda não cobrado"],
    ["vendi capinha e cabo USB por 70 no Pix", "doubt=Lance a venda de acessórios em Vendas do dia."],
    ["troquei a tela por 260", "doubt=Os R$ 260 já foram recebidos? Se sim, qual foi a forma de pagamento?"],
    ["troca tela XR 300", "doubt=Os R$ 300 são o preço do serviço? Se já recebeu, qual foi a forma de pagamento?"],
];

export function launchInstructions(kind) {
    const service = kind === "SERVICO";
    const kindRules = service
        ? [
            "Modo SERVIÇO. Em product descreva o reparo. Em service_parts coloque peças, fornecedor, custo e situação da peça, com uma peça por linha. Não venda acessórios neste modo. Se for apenas venda de acessórios, direcione para Vendas do dia em doubt.",
            "Uma peça avulsa sem manutenção é válida se service_parts estiver preenchido. Serviço sem cobrança ou valor informado pode ter todos os valores zerados. Pendência de compra da peça é custo do fornecedor, não é valor pendente do cliente.",
        ]
        : [
            "Modo VENDA. Preencha product com o produto vendido e deixe service_parts vazio. Se o texto descreve apenas manutenção ou peças para manutenção, direcione para Serviços em doubt.",
            "Se há aparelho recebido mas não há valor informado, preserve o aparelho para revisão. Se não há pagamento, pendência nem aparelho recebido, peça o valor e a forma de pagamento em doubt.",
        ];
    const examples = [...paymentExamples, ...(service ? serviceExamples : saleExamples)];
    return [
        ...sharedRules, ...kindRules,
        "Os exemplos abaixo listam só os campos relevantes. Na resposta real inclua todos os campos do esquema, use números em valores e aplique as regras ao texto novo.",
        ...examples.map(([input, output]) => JSON.stringify(input) + " → " + output),
    ].join("\n");
}
