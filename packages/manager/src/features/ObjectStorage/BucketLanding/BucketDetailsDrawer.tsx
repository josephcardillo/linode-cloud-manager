import {
  getBucketAccess,
  updateBucketAccess,
} from '@linode/api-v4/lib/object-storage';
import { styled } from '@mui/material/styles';
import * as React from 'react';

import { CopyTooltip } from 'src/components/CopyTooltip/CopyTooltip';
import { Divider } from 'src/components/Divider';
import { Drawer } from 'src/components/Drawer';
import { Link } from 'src/components/Link';
import { Typography } from 'src/components/Typography';
import { useAccountManagement } from 'src/hooks/useAccountManagement';
import { useFlags } from 'src/hooks/useFlags';
import { useObjectStorageClusters } from 'src/queries/object-storage/queries';
import { useProfile } from 'src/queries/profile/profile';
import { useRegionQuery, useRegionsQuery } from 'src/queries/regions/regions';
import { isFeatureEnabledV2 } from 'src/utilities/accountCapabilities';
import { formatDate } from 'src/utilities/formatDate';
import { pluralize } from 'src/utilities/pluralize';
import { truncateMiddle } from 'src/utilities/truncate';
import { readableBytes } from 'src/utilities/unitConversions';

import { AccessSelect } from '../BucketDetail/AccessSelect';
import { BucketRateLimitTable } from './BucketRateLimitTable';

import type {
  ACLType,
  ObjectStorageBucket,
} from '@linode/api-v4/lib/object-storage';

export interface BucketDetailsDrawerProps {
  onClose: () => void;
  open: boolean;
  selectedBucket: ObjectStorageBucket | undefined;
}

export const BucketDetailsDrawer = React.memo(
  (props: BucketDetailsDrawerProps) => {
    const { onClose, open, selectedBucket } = props;

    const {
      cluster,
      created,
      endpoint_type,
      hostname,
      label,
      objects,
      region,
      size,
    } = selectedBucket ?? {};

    const flags = useFlags();
    const { account } = useAccountManagement();

    const isObjMultiClusterEnabled = isFeatureEnabledV2(
      'Object Storage Access Key Regions',
      Boolean(flags.objMultiCluster),
      account?.capabilities ?? []
    );

    // @TODO OBJGen2 - We could clean this up when OBJ Gen2 is in GA.
    const { data: clusters } = useObjectStorageClusters(
      !isObjMultiClusterEnabled
    );
    const { data: regions } = useRegionsQuery();
    const { data: currentRegion } = useRegionQuery(region ?? '');
    const { data: profile } = useProfile();

    // @TODO OBJGen2 - We could clean this up when OBJ Gen2 is in GA.
    const selectedCluster = clusters?.find((c) => c.id === cluster);
    const regionFromCluster = regions?.find(
      (r) => r.id === selectedCluster?.region
    );

    let formattedCreated;
    const showBucketRateLimitTable =
      endpoint_type === 'E2' || endpoint_type === 'E3';

    try {
      if (created) {
        formattedCreated = formatDate(created, {
          timezone: profile?.timezone,
        });
      }
    } catch {}

    return (
      <Drawer
        onClose={onClose}
        open={open}
        title={truncateMiddle(label ?? 'Bucket Detail')}
      >
        {formattedCreated && (
          <Typography data-testid="createdTime" variant="subtitle2">
            Created: {formattedCreated}
          </Typography>
        )}
        {Boolean(endpoint_type) && (
          <Typography data-testid="endpointType" variant="subtitle2">
            Endpoint Type: {endpoint_type}
          </Typography>
        )}
        {isObjMultiClusterEnabled ? (
          <Typography data-testid="cluster" variant="subtitle2">
            {currentRegion?.label}
          </Typography>
        ) : cluster ? (
          <Typography data-testid="cluster" variant="subtitle2">
            {regionFromCluster?.label ?? cluster}
          </Typography>
        ) : null}
        {hostname && (
          <StyledLinkContainer>
            <Link external to={`https://${hostname}`}>
              {truncateMiddle(hostname, 50)}
            </Link>
            <StyledCopyTooltip sx={{ marginLeft: 4 }} text={hostname} />
          </StyledLinkContainer>
        )}
        {(formattedCreated || cluster) && (
          <Divider spacingBottom={16} spacingTop={16} />
        )}
        {typeof size === 'number' && (
          <Typography variant="subtitle2">
            {readableBytes(size).formatted}
          </Typography>
        )}
        {/* @TODO OBJ Multicluster: use region instead of cluster if isObjMultiClusterEnabled. */}
        {typeof objects === 'number' && (
          <Link
            to={`/object-storage/buckets/${
              isObjMultiClusterEnabled && selectedBucket ? region : cluster
            }/${label}`}
          >
            {pluralize('object', 'objects', objects)}
          </Link>
        )}
        {(typeof size === 'number' || typeof objects === 'number') && (
          <Divider spacingBottom={16} spacingTop={16} />
        )}
        {/* @TODO OBJ Multicluster: use region instead of cluster if isObjMultiClusterEnabled
         to getBucketAccess and updateBucketAccess.  */}
        {
          <>
            <Typography data-testid="bucketRateLimit" variant="h3">
              Bucket Rate Limits
            </Typography>
            {showBucketRateLimitTable ? (
              <BucketRateLimitTable endpointType={endpoint_type} />
            ) : (
              <Typography>
                This endpoint type supports up to 750 Requests Per Second(RPS).{' '}
                <Link to="#">Understand bucket rate limits</Link>.
              </Typography>
            )}
          </>
        }
        {<Divider spacingBottom={16} spacingTop={16} />}
        {cluster && label && (
          <AccessSelect
            getAccess={() =>
              getBucketAccess(
                isObjMultiClusterEnabled && currentRegion
                  ? currentRegion.id
                  : cluster,
                label
              )
            }
            updateAccess={(acl: ACLType, cors_enabled: boolean) => {
              // Don't send the ACL with the payload if it's "custom", since it's
              // not valid (though it's a valid return type).
              const payload =
                acl === 'custom' ? { cors_enabled } : { acl, cors_enabled };

              return updateBucketAccess(
                isObjMultiClusterEnabled && currentRegion
                  ? currentRegion.id
                  : cluster,
                label,
                payload
              );
            }}
            name={label}
            variant="bucket"
          />
        )}
      </Drawer>
    );
  }
);

const StyledCopyTooltip = styled(CopyTooltip, {
  label: 'StyledRootContainer',
})(() => ({
  marginLeft: '1em',
  padding: 0,
}));

const StyledLinkContainer = styled('span', {
  label: 'StyledLinkContainer',
})(() => ({
  display: 'flex',
}));
