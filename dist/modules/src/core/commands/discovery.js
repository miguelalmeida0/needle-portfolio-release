export function createDiscoveryCommands(context) {
    return {
        select: (id) => ({ id: 'view.discovery.select', run: () => {
                if (context.canSelect(id))
                    context.select(id);
            } }),
        back: () => ({ id: 'view.discovery.return', run: context.returnToShelf }),
    };
}
//# sourceMappingURL=discovery.js.map