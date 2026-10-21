import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useMutation } from '@/hooks/useMutation';
import { inventory } from '@/services';
import type { AdjustMode, StockAdjustment } from '@/services/inventoryService';
import { colors, radius, spacing } from '@/theme';
import type { ProductView } from '@/types/models';
import { formatQty } from '@/utils/format';

import { AppText, BottomSheet, Button, Chip, QuantityStepper, SegmentedControl, TextField } from './ui';

const REASONS: { value: StockAdjustment['reason']; label: string }[] = [
  { value: 'restock', label: 'New stock' },
  { value: 'spoilage', label: 'Spoilt / damaged' },
  { value: 'adjustment', label: 'Count correction' },
];

const DEFAULT_REASON: Record<AdjustMode, StockAdjustment['reason']> = { add: 'restock', remove: 'spoilage', set: 'adjustment' };

interface Props {
  product: ProductView | null;
  initialMode?: AdjustMode;
  onClose: () => void;
}

export function StockAdjustSheet({ product, initialMode = 'add', onClose }: Props) {
  const [mode, setMode] = useState<AdjustMode>(initialMode);
  const [qty, setQty] = useState(1);
  const [qtyText, setQtyText] = useState('1');
  const [reason, setReason] = useState<StockAdjustment['reason']>(DEFAULT_REASON[initialMode]);
  const [note, setNote] = useState('');
  const save = useMutation((id: string, adj: StockAdjustment) => inventory.adjustStock(id, adj), {
    success: (stock) => `Stock updated — ${stock} now in stock`,
  });

  useEffect(() => {
    if (!product) return;
    setMode(initialMode);
    setReason(DEFAULT_REASON[initialMode]);
    const start = initialMode === 'set' ? product.stock : initialMode === 'add' ? Math.max(product.lowStockThreshold * 2, 5) : 1;
    setQty(start);
    setQtyText(String(start));
    setNote('');
  }, [product, initialMode]);

  if (!product) return null;

  const changeMode = (m: AdjustMode) => {
    setMode(m);
    setReason(DEFAULT_REASON[m]);
    const v = m === 'set' ? product.stock : 1;
    setQty(v);
    setQtyText(String(v));
  };

  const setBoth = (n: number) => {
    const v = Math.max(0, Math.min(100000, n));
    setQty(v);
    setQtyText(String(v));
  };

  const after = mode === 'add' ? product.stock + qty : mode === 'remove' ? product.stock - qty : qty;
  const invalid = after < 0 || (mode !== 'set' && qty <= 0) || (mode === 'set' && qty === product.stock);

  return (
    <BottomSheet
      visible={!!product}
      onClose={onClose}
      title="Update stock"
      subtitle={`${product.name} · ${formatQty(product.stock, product.unit)} now`}
      footer={
        <Button
          title={invalid && after < 0 ? `Only ${product.stock} in stock` : 'Save stock'}
          size="lg"
          fullWidth
          disabled={invalid}
          loading={save.busy}
          onPress={async () => {
            const res = await save.run(product.id, { mode, quantity: qty, reason, note: note.trim() || undefined });
            if (res !== undefined) onClose();
          }}
        />
      }
    >
      <SegmentedControl
        value={mode}
        onChange={changeMode}
        segments={[
          { value: 'add', label: 'Add' },
          { value: 'remove', label: 'Remove' },
          { value: 'set', label: 'Set exact' },
        ]}
      />
      <View style={styles.qtyRow}>
        <QuantityStepper value={qty} onChange={setBoth} min={0} max={mode === 'remove' ? product.stock : 100000} size="lg" />
        <View style={{ flex: 1 }}>
          <TextField
            value={qtyText}
            onChangeText={(t) => {
              const clean = t.replace(/\D/g, '').slice(0, 6);
              setQtyText(clean);
              setQty(Number(clean || 0));
            }}
            keyboardType="number-pad"
            suffix={product.unit}
            accessibilityLabel="Quantity"
          />
        </View>
      </View>
      <View style={[styles.preview, after < 0 && { backgroundColor: colors.dangerLight }]}>
        <AppText variant="small">New stock level</AppText>
        <AppText variant="h2" color={after < 0 ? colors.danger : after <= product.lowStockThreshold ? colors.warning : colors.primaryDark}>
          {after < 0 ? '—' : formatQty(after, product.unit)}
        </AppText>
      </View>
      <AppText variant="label" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        Reason
      </AppText>
      <View style={styles.chips}>
        {REASONS.map((r) => (
          <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />
        ))}
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <TextField placeholder="Note (optional), e.g. From Wakulima market" value={note} onChangeText={setNote} maxLength={120} icon="create-outline" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  qtyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xl },
  preview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
