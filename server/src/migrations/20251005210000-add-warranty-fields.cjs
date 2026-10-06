'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('repair_orders', 'advance_payment', {
      type: Sequelize.DECIMAL(10,2),
      allowNull: true,
      defaultValue: 0.00
    });
    await queryInterface.addColumn('repair_orders', 'lock_type', {
      type: Sequelize.ENUM('Sin bloqueo','Patrón','PIN','Contraseña','Cuenta Google','iCloud','MDM','Otro'),
      defaultValue: 'Sin bloqueo'
    });
    await queryInterface.addColumn('repair_orders', 'warranty_value', {
      type: Sequelize.INTEGER,
      defaultValue: 10
    });
    await queryInterface.addColumn('repair_orders', 'warranty_unit', {
      type: Sequelize.ENUM('Días','Meses'),
      defaultValue: 'Días'
    });
    await queryInterface.addColumn('repair_orders', 'warranty_ends_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('repair_orders', 'advance_payment');
    await queryInterface.removeColumn('repair_orders', 'lock_type');
    await queryInterface.removeColumn('repair_orders', 'warranty_value');
    await queryInterface.removeColumn('repair_orders', 'warranty_unit');
    await queryInterface.removeColumn('repair_orders', 'warranty_ends_at');
  }
};