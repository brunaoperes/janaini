import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Usar service role key para bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    // Verificar se tem a service key
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ler os clientes do arquivo JSON
    const clientesPath = path.join(process.cwd(), 'scripts', 'clientes-usalon.json');

    if (!fs.existsSync(clientesPath)) {
      return NextResponse.json(
        { error: 'Arquivo clientes-usalon.json não encontrado' },
        { status: 404 }
      );
    }

    const clientes = JSON.parse(fs.readFileSync(clientesPath, 'utf8'));

    // Buscar clientes existentes
    const { data: existingClients } = await supabase
      .from('clientes')
      .select('nome, telefone');

    const existingSet = new Set<string>();
    if (existingClients) {
      existingClients.forEach(c => {
        existingSet.add(c.nome?.toLowerCase().trim());
        if (c.telefone) existingSet.add(c.telefone);
      });
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    // Importar em lotes
    const batchSize = 50;
    const toInsertAll: { nome: string; telefone: string | null; aniversario: null }[] = [];

    for (const cliente of clientes) {
      const nomeNormalizado = cliente.nome?.toLowerCase().trim();

      if (existingSet.has(nomeNormalizado) || (cliente.telefone && existingSet.has(cliente.telefone))) {
        skipped++;
        continue;
      }

      let nome = cliente.nome?.trim() || 'Cliente sem nome';
      nome = nome.replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '').trim();
      if (!nome) nome = cliente.nome?.trim() || 'Cliente sem nome';

      let telefone = cliente.telefone;
      if (telefone) {
        telefone = telefone.replace(/\D/g, '');
        if (telefone.startsWith('55') && telefone.length >= 12) {
          // OK
        } else if (telefone.length === 11) {
          telefone = '55' + telefone;
        } else if (telefone.length === 10) {
          telefone = '55' + telefone;
        }
      }

      toInsertAll.push({
        nome: nome,
        telefone: telefone || null,
        aniversario: null,
      });

      existingSet.add(nomeNormalizado);
      if (telefone) existingSet.add(telefone);
    }

    // Inserir em lotes
    for (let i = 0; i < toInsertAll.length; i += batchSize) {
      const batch = toInsertAll.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from('clientes')
        .insert(batch)
        .select();

      if (error) {
        errorMessages.push(`Lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        errors += batch.length;
      } else {
        imported += data.length;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      errorMessages: errorMessages.slice(0, 5), // Primeiros 5 erros apenas
      total: clientes.length,
    });

  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
