import { Fragment } from 'react';

import { Box, Icon, TextButton } from '@strapi/design-system';
import {
  SubNav,
  SubNavHeader,
  SubNavLink,
  SubNavLinkSection,
  SubNavSection,
  SubNavSections,
} from '@strapi/design-system/v2';
import { Plus } from '@strapi/icons';
import upperFirst from 'lodash/upperFirst';
import { useIntl } from 'react-intl';
import { NavLink } from 'react-router-dom';

import { getTrad } from '../../utils/getTrad';

import { useContentTypeBuilderMenu } from './useContentTypeBuilderMenu';

export const ContentTypeBuilderNav = () => {
  const { menu, searchValue, onSearchChange } = useContentTypeBuilderMenu();
  const { formatMessage } = useIntl();

  return (
    <SubNav
      ariaLabel={formatMessage({
        id: `${getTrad('plugin.name')}`,
        defaultMessage: 'Content-Types Builder',
      })}
    >
      <SubNavHeader
        searchable
        value={searchValue}
        onClear={() => onSearchChange('')}
        onChange={(e) => onSearchChange(e.target.value)}
        label={formatMessage({
          id: `${getTrad('plugin.name')}`,
          defaultMessage: 'Content-Types Builder',
        })}
        searchLabel={formatMessage({
          id: 'global.search',
          defaultMessage: 'Search',
        })}
      />
      <SubNavSections>
        {menu.map((section) => (
          <Fragment key={section.name}>
            <SubNavSection
              label={formatMessage({
                id: section.title.id,
                defaultMessage: section.title.defaultMessage,
              })}
              collapsable
              badgeLabel={section.links.length.toString()}
            >
              {section.links.map((link) => {
                if (link.links) {
                  return (
                    <SubNavLinkSection key={link.name} label={upperFirst(link.title)}>
                      {link.links.map((subLink: any) => (
                        <SubNavLink
                          as={NavLink}
                          // @ts-expect-error verify if "to" is needed
                          to={subLink.to}
                          active={subLink.active}
                          key={subLink.name}
                          isSubSectionChild
                        >
                          {upperFirst(
                            formatMessage({ id: subLink.name, defaultMessage: subLink.title })
                          )}
                        </SubNavLink>
                      ))}
                    </SubNavLinkSection>
                  );
                }

                return (
                  // @ts-expect-error verify if "to" is needed
                  <SubNavLink as={NavLink} to={link.to} active={link.active} key={link.name}>
                    {upperFirst(formatMessage({ id: link.name, defaultMessage: link.title }))}
                  </SubNavLink>
                );
              })}
            </SubNavSection>
            {section.customLink && (
              <Box paddingLeft={7}>
                <TextButton
                  onClick={section.customLink.onClick}
                  startIcon={<Icon as={Plus} width={`${8 / 16}rem`} height={`${8 / 16}rem`} />}
                  marginTop={2}
                >
                  {formatMessage({
                    id: section.customLink.id,
                    defaultMessage: section.customLink.defaultMessage,
                  })}
                </TextButton>
              </Box>
            )}
          </Fragment>
        ))}
      </SubNavSections>
    </SubNav>
  );
};
