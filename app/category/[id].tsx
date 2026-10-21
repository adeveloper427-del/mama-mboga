import { router, useLocalSearchParams } from 'expo-router';

import { ProductBrowser } from '@/components/ProductBrowser';
import { Header, IconButton, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { catalog } from '@/services';

export default function CategoryPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cat = useQuery(`category:${id}`, () => catalog.getCategory(id), ['categories']);

  return (
    <Screen
      padded={false}
      scroll={false}
      header={
        <Header
          title={cat.data?.name ?? 'Category'}
          subtitle={cat.data?.swahili}
          right={<IconButton icon="search" label="Search" onPress={() => router.push('/search')} />}
        />
      }
    >
      <ProductBrowser categoryId={id} emptyTitle="Nothing in this category yet" />
    </Screen>
  );
}
