/* eslint-disable check-file/filename-naming-convention */
import * as React from 'react';

import invariant from 'invariant';
import { MessageDescriptor, PrimitiveType } from 'react-intl';
import { Provider } from 'react-redux';
import { createBrowserRouter, createMemoryRouter } from 'react-router-dom';

import { App } from '../../App';
import { ErrorElement } from '../../components/ErrorElement';
import { LanguageProvider } from '../../components/LanguageProvider';
import { Theme } from '../../components/Theme';
import { Permission } from '../../features/Auth';
import { StrapiApp } from '../../StrapiApp';

type IRouter = ReturnType<typeof createBrowserRouter> | ReturnType<typeof createMemoryRouter>;

type Reducer<Config extends object> = (prev: Config[]) => Config[];

interface MenuItem {
  to: string;
  icon: React.ElementType;
  intlLabel: MessageDescriptor & { values?: Record<string, PrimitiveType> };
  permissions: Permission[];
  notificationsCount?: number;
  Component: React.LazyExoticComponent<React.ComponentType>;
  exact?: boolean;
  lockIcon?: boolean;
}

interface StrapiAppSettingLink extends Omit<MenuItem, 'icon' | 'notificationCount'> {
  id: string;
}

interface UnloadedSettingsLink extends Omit<StrapiAppSettingLink, 'Component'> {
  Component: () => Promise<{ default: React.ComponentType }>;
}

interface StrapiAppSetting {
  id: string;
  intlLabel: MessageDescriptor & {
    values?: Record<string, PrimitiveType>;
  };
  links: StrapiAppSettingLink[];
}

interface RouteObject {}

interface RouterOptions {
  basename?: string;
  memory?: boolean;
}

class Router {
  private _routes: RouteObject[] = [];
  private router: IRouter | null = null;
  private _menu: MenuItem[] = [];
  private _settings: Record<string, StrapiAppSetting> = {
    global: {
      id: 'global',
      intlLabel: {
        id: 'Settings.global',
        defaultMessage: 'Global Settings',
      },
      links: [],
    },
  };

  constructor(initialRoutes: RouteObject[]) {
    this._routes = initialRoutes;
  }

  get routes() {
    return this._routes;
  }

  get menu() {
    return this._menu;
  }

  get settings() {
    return this._settings;
  }

  /**
   * @internal This method is used internally by Strapi to create the router.
   * It should not be used by plugins, doing so will likely break the application.
   */
  createRouter(strapi: StrapiApp, { memory, ...opts }: RouterOptions = {}) {
    const routes = [
      {
        path: '/*',
        errorElement: (
          <Provider store={strapi.store!}>
            <LanguageProvider messages={strapi.configurations.translations}>
              <Theme themes={strapi.configurations.themes}>
                <ErrorElement />
              </Theme>
            </LanguageProvider>
          </Provider>
        ),
        element: <App strapi={strapi} store={strapi.store!} />,
        children: this.routes,
      },
    ];

    if (memory) {
      this.router = createMemoryRouter(routes, opts);
    } else {
      this.router = createBrowserRouter(routes, opts);
    }

    return this.router;
  }

  public addMenuLink = (
    link: Omit<MenuItem, 'Component'> & {
      Component: () => Promise<{ default: React.ComponentType }>;
    }
  ) => {
    invariant(link.to, `[${link.intlLabel.defaultMessage}]: link.to should be defined`);
    invariant(
      typeof link.to === 'string',
      `[${
        link.intlLabel.defaultMessage
      }]: Expected link.to to be a string instead received ${typeof link.to}`
    );
    invariant(
      link.intlLabel?.id && link.intlLabel?.defaultMessage,
      `[${link.intlLabel.defaultMessage}]: link.intlLabel.id & link.intlLabel.defaultMessage should be defined`
    );
    invariant(
      link.Component && typeof link.Component === 'function',
      `[${link.intlLabel.defaultMessage}]: link.Component must be a function returning a Promise that returns a default component. Please use: \`Component: () => import(path)\` instead.`
    );
    invariant(
      link.icon && typeof link.icon === 'function',
      `[${link.intlLabel.defaultMessage}]: link.Icon should be a valid React Component`
    );

    if (
      link.Component &&
      typeof link.Component === 'function' &&
      // @ts-expect-error – shh
      link.Component[Symbol.toStringTag] === 'AsyncFunction'
    ) {
      console.warn(
        `
      [${link.intlLabel.defaultMessage}]: [deprecated] addMenuLink() was called with an async Component from the plugin "${link.intlLabel.defaultMessage}". This will be removed in the future. Please use: \`Component: () => import(path)\` ensuring you return a default export instead.
      `.trim()
      );
    }

    if (link.to.startsWith('/')) {
      console.warn(
        `[${link.intlLabel.defaultMessage}]: the \`to\` property of your menu link is an absolute path, it should be relative to the root of the application. This has been corrected for you but will be removed in a future version of Strapi.`
      );

      link.to = link.to.slice(1);
    }

    this._menu.push({
      ...link,
      Component: React.lazy(async () => {
        const mod = await link.Component();

        if ('default' in mod) {
          return mod;
        } else {
          return { default: mod };
        }
      }),
    });
  };

  public addSettingsLink(
    section: Pick<StrapiAppSetting, 'id' | 'intlLabel'> & { links: UnloadedSettingsLink[] },
    links?: never
  ): void;
  public addSettingsLink(
    sectionId: string | Pick<StrapiAppSetting, 'id' | 'intlLabel'>,
    link: UnloadedSettingsLink
  ): void;
  public addSettingsLink(
    sectionId: string | Pick<StrapiAppSetting, 'id' | 'intlLabel'>,
    link: UnloadedSettingsLink[]
  ): void;
  public addSettingsLink(
    section:
      | string
      | Pick<StrapiAppSetting, 'id' | 'intlLabel'>
      | (Pick<StrapiAppSetting, 'id' | 'intlLabel'> & { links: UnloadedSettingsLink[] }),
    link?: UnloadedSettingsLink | UnloadedSettingsLink[]
  ): void {
    if (typeof section === 'object' && 'links' in section) {
      /**
       * Someone has passed an entire pre-configured section object
       */
      invariant(section.id, 'section.id should be defined');
      invariant(
        section.intlLabel?.id && section.intlLabel?.defaultMessage,
        'section.intlLabel should be defined'
      );
      invariant(this.settings[section.id] === undefined, 'A similar section already exists');
      invariant(Array.isArray(section.links), 'TypeError expected links to be an array');

      this.settings[section.id] = { ...section, links: [] };

      section.links.forEach((link) => {
        this.createSettingsLink(section.id, link);
      });
    } else if (typeof section === 'object' && link) {
      /**
       * we need to create the section first
       */
      invariant(section.id, 'section.id should be defined');
      invariant(
        section.intlLabel?.id && section.intlLabel?.defaultMessage,
        'section.intlLabel should be defined'
      );
      invariant(this.settings[section.id] === undefined, 'A similar section already exists');

      this.settings[section.id] = { ...section, links: [] };

      if (Array.isArray(link)) {
        link.forEach((l) => this.createSettingsLink(section.id, l));
      } else {
        this.createSettingsLink(section.id, link);
      }
    } else if (typeof section === 'string' && link) {
      if (Array.isArray(link)) {
        link.forEach((l) => this.createSettingsLink(section, l));
      } else {
        this.createSettingsLink(section, link);
      }
    } else {
      throw new Error(
        'Invalid arguments provided to addSettingsLink, at minimum a sectionId and link are required.'
      );
    }
  }

  private createSettingsLink = (sectionId: string, link: UnloadedSettingsLink) => {
    invariant(this._settings[sectionId], 'The section does not exist');

    invariant(link.id, `[${link.intlLabel.defaultMessage}]: link.id should be defined`);
    invariant(
      link.intlLabel?.id && link.intlLabel?.defaultMessage,
      `[${link.intlLabel.defaultMessage}]: link.intlLabel.id & link.intlLabel.defaultMessage`
    );
    invariant(link.to, `[${link.intlLabel.defaultMessage}]: link.to should be defined`);
    invariant(
      link.Component && typeof link.Component === 'function',
      `[${link.intlLabel.defaultMessage}]: link.Component must be a function returning a Promise. Please use: \`Component: () => import(path)\` instead.`
    );

    if (
      link.Component &&
      typeof link.Component === 'function' &&
      // @ts-expect-error – shh
      link.Component[Symbol.toStringTag] === 'AsyncFunction'
    ) {
      console.warn(
        `
      [${link.intlLabel.defaultMessage}]: [deprecated] addSettingsLink() was called with an async Component from the plugin "${link.intlLabel.defaultMessage}". This will be removed in the future. Please use: \`Component: () => import(path)\` ensuring you return a default export instead.
      `.trim()
      );
    }

    if (link.to.startsWith('/')) {
      console.warn(
        `[${link.intlLabel.defaultMessage}]: the \`to\` property of your settings link is an absolute path. It should be relative to \`/settings\`. This has been corrected for you but will be removed in a future version of Strapi.`
      );

      link.to = link.to.slice(1);
    }

    if (link.to.split('/')[0] === 'settings') {
      console.warn(
        `[${link.intlLabel.defaultMessage}]: the \`to\` property of your settings link has \`settings\` as the first part of it's path. It should be relative to \`settings\` and therefore, not include it. This has been corrected for you but will be removed in a future version of Strapi.`
      );

      link.to = link.to.split('/').slice(1).join('/');
    }

    this._settings[sectionId].links.push({
      ...link,
      Component: React.lazy(async () => {
        const mod = await link.Component();

        if ('default' in mod) {
          return mod;
        } else {
          return { default: mod };
        }
      }),
    });
  };

  addRoute(route: RouteObject | RouteObject[] | Reducer<RouteObject>) {}
}

export { Router };
export type { MenuItem, StrapiAppSettingLink, UnloadedSettingsLink, StrapiAppSetting, RouteObject };
