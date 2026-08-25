# Third-Party Notices

arxiv2zh is an independent community project and is not affiliated with or
endorsed by Zotero, arXiv, or hjfy.top.

The distributed plugin has no standalone runtime package dependencies. Its
production bundle uses Zotero's native plugin APIs.

## Development and project foundation

- [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
  provided the initial plugin structure.
- [zotero-plugin-scaffold](https://github.com/zotero-plugin-dev/zotero-plugin-scaffold)
  is used to develop, test, package, and release the plugin under
  `AGPL-3.0-or-later`.
- The bootstrap structure follows Zotero's
  [Make It Red](https://github.com/zotero/make-it-red) example and Zotero plugin
  development documentation.
- [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh) informed the
  interaction design. arxiv2zh does not bundle that project.

Development-only packages and their exact versions are listed in
`package-lock.json`. They are not included as standalone packages in the
distributed XPI.

## External services and content

- [hjfy.top](https://hjfy.top/) is the third-party translation service used by
  the default configuration. Its availability, terms, privacy practices, and
  generated output are controlled by its operator.
- [arXiv](https://arxiv.org/) hosts papers and metadata referenced by the plugin.
  Papers and translated output remain subject to their respective licenses and
  applicable law.
- [Zotero](https://www.zotero.org/) provides the host application and APIs.

The names and marks of third parties belong to their respective owners.
