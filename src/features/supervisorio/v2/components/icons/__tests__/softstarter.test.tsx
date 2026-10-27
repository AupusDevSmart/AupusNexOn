import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getEquipmentIcon, EquipmentIconWrapper, getEquipmentIconBody } from '../EquipmentIconFactory';
import { SoftStarterIcon } from '../SoftStarterIcon';
import { getEquipmentSizeInPixels } from '../../../utils/diagramConstants';

describe('soft-starter no unifilar', () => {
  it('resolve o símbolo pela categoria e pelo código', () => {
    expect(getEquipmentIcon('Soft-Starter')).toBe(SoftStarterIcon);
    expect(getEquipmentIcon('SOFTSTARTER')).toBe(SoftStarterIcon);
    expect(getEquipmentIconBody('Soft-Starter', 'SOFTSTARTER')).not.toBeNull();
    expect(getEquipmentSizeInPixels('SOFTSTARTER').width).toBeGreaterThan(0);
  });
  it('desenha o SVG', () => {
    const html = renderToStaticMarkup(<EquipmentIconWrapper categoria="Soft-Starter" tipo="SOFTSTARTER" width={80} height={80} color="#9ca3af" />);
    expect(html).toContain('<polygon');
    expect(html).toContain('<rect');
  });
});
