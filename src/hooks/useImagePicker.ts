import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import type { PickedImage } from '@/services/storageService';
import { useDialog } from '@/store/DialogContext';
import { useToast } from '@/store/ToastContext';

/**
 * Lets the user take or choose a photo. Permission is requested only at the
 * moment they tap the button, never on app start.
 */
export function useImagePicker() {
  const toast = useToast();
  const dialog = useDialog();

  return useCallback(
    async (aspect: [number, number] = [1, 1]): Promise<PickedImage | null> => {
      let useCamera = false;
      if (Platform.OS !== 'web') {
        useCamera = await dialog.confirm({
          title: 'Add a photo',
          message: 'Take a new photo or choose one from your gallery.',
          confirmLabel: 'Camera',
          cancelLabel: 'Gallery',
          icon: 'camera-outline',
        });
      }
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show(`Allow ${useCamera ? 'camera' : 'photo'} access in your phone settings to add a picture.`, 'error');
        return null;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.7 };
      const result = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return null;
      const a = result.assets[0];
      return { uri: a.uri, fileSize: a.fileSize, mimeType: a.mimeType };
    },
    [dialog, toast],
  );
}
