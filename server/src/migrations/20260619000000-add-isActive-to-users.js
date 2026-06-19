'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'isActive', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'mustChangePassword',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'isActive');
  },
};
