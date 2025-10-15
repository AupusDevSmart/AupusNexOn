// src/utils/address.utils.ts

export interface AddressComponents {
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

/**
 * Concatena os componentes de endereço em uma string formatada
 * Exemplo: "Rua ABC, 123, Apto 45 - Centro - São Paulo/SP - CEP: 01234-567"
 */
export function concatenateAddress(components: AddressComponents): string {
  const parts: string[] = [];

  // Logradouro + Número
  if (components.endereco) {
    let logradouroPart = components.endereco;
    if (components.numero) {
      logradouroPart += `, ${components.numero}`;
    }
    parts.push(logradouroPart);
  } else if (components.numero) {
    parts.push(`Nº ${components.numero}`);
  }

  // Complemento
  if (components.complemento) {
    parts.push(components.complemento);
  }

  // Bairro
  if (components.bairro) {
    parts.push(components.bairro);
  }

  // Cidade/Estado
  if (components.cidade && components.estado) {
    parts.push(`${components.cidade}/${components.estado}`);
  } else if (components.cidade) {
    parts.push(components.cidade);
  } else if (components.estado) {
    parts.push(components.estado);
  }

  // CEP
  if (components.cep) {
    parts.push(`CEP: ${components.cep}`);
  }

  // Join parts with appropriate separators
  let result = '';
  if (parts.length > 0) {
    // First 3 parts (logradouro, complemento, bairro) separated by ", "
    const firstParts = parts.slice(0, 3).join(', ');
    // Remaining parts separated by " - "
    const remainingParts = parts.slice(3).join(' - ');

    result = firstParts;
    if (remainingParts) {
      result += ' - ' + remainingParts;
    }
  }

  return result;
}

/**
 * Parse a concatenated address string back into components
 * Note: This is a best-effort parsing and may not work perfectly for all formats
 */
export function parseAddress(address: string): Partial<AddressComponents> {
  const components: Partial<AddressComponents> = {};

  if (!address) return components;

  // Extract CEP if present
  const cepMatch = address.match(/CEP:\s*(\d{5}-?\d{3})/i);
  if (cepMatch) {
    components.cep = cepMatch[1];
    address = address.replace(cepMatch[0], '').trim();
  }

  // Split by main separators
  const parts = address.split(/\s*-\s*/);

  if (parts.length > 0) {
    // First part contains logradouro, numero, complemento, bairro (separated by commas)
    const firstPartItems = parts[0].split(/\s*,\s*/);

    if (firstPartItems.length > 0) {
      components.endereco = firstPartItems[0];
    }
    if (firstPartItems.length > 1) {
      // Check if second item is a number (numero) or text (complemento)
      const secondItem = firstPartItems[1];
      if (/^\d+$/.test(secondItem)) {
        components.numero = secondItem;
      } else {
        components.complemento = secondItem;
      }
    }
    if (firstPartItems.length > 2) {
      components.bairro = firstPartItems[2];
    }
  }

  if (parts.length > 1) {
    // Second part is cidade/estado
    const cidadeEstado = parts[1].split('/');
    if (cidadeEstado.length === 2) {
      components.cidade = cidadeEstado[0].trim();
      components.estado = cidadeEstado[1].trim();
    } else {
      components.cidade = parts[1].trim();
    }
  }

  return components;
}

/**
 * Format CEP with mask: 12345-678
 */
export function formatCEP(cep: string): string {
  const numbers = cep.replace(/\D/g, '');
  if (numbers.length !== 8) return cep;
  return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
}

/**
 * Remove CEP mask
 */
export function unformatCEP(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Validate CEP format
 */
export function isValidCEP(cep: string): boolean {
  const numbers = unformatCEP(cep);
  return numbers.length === 8 && /^\d+$/.test(numbers);
}

/**
 * Get short address format (just street and city)
 */
export function getShortAddress(components: AddressComponents): string {
  const parts: string[] = [];

  if (components.endereco) {
    parts.push(components.endereco);
  }

  if (components.cidade) {
    parts.push(components.cidade);
  }

  return parts.join(', ');
}
