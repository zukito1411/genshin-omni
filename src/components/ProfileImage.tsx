import type { ComponentProps } from 'react';
import { AsyncImage } from './AsyncImage';
import { profileImageSources } from '../utils/profileImages';

export function ProfileImage(props: ComponentProps<typeof AsyncImage>) {
  return <AsyncImage {...props} src={profileImageSources(props.src)} />;
}
